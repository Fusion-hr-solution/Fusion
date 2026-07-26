using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.EmployeeObjectives;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Dtos;
using EY.HRPlatform.Performance.Features.Progress.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Progress.Commands;

public sealed record RecordObjectiveProgressCommand(
    Guid CycleId,
    Guid ObjectiveId,
    uint ExpectedVersion,
    RecordObjectiveProgressRequest Request)
    : ICommand<Result<RecordObjectiveProgressResponseDto>>;

public sealed class RecordObjectiveProgressCommandHandler(
    PerformanceDbContext dbContext,
    EmployeeObjectivePlanAccessGuard accessGuard,
    ActivityLog.IActivityLog activityLog,
    ICurrentUserContext currentUser) : ICommandHandler<RecordObjectiveProgressCommand, Result<RecordObjectiveProgressResponseDto>>
{
    public async Task<Result<RecordObjectiveProgressResponseDto>> Handle(
        RecordObjectiveProgressCommand request,
        CancellationToken cancellationToken)
    {
        if (currentUser.UserId is not { } actorUserId || actorUserId == Guid.Empty)
            return Result.Failure<RecordObjectiveProgressResponseDto>(Error.Forbidden(
                "ObjectiveProgress.ActorRequired",
                "A signed-in user is required to record progress."));

        var participantResult = await accessGuard.RequireParticipantAsync(request.CycleId, cancellationToken);
        if (participantResult.IsFailure)
            return Result.Failure<RecordObjectiveProgressResponseDto>(participantResult.Error);
        var participant = participantResult.Value;

        var excluded = await dbContext.PerformanceCycleParticipantExclusions
            .AsNoTracking()
            .AnyAsync(
                exclusion => exclusion.CycleId == request.CycleId
                             && exclusion.ParticipantEmployeeId == participant.EmployeeId,
                cancellationToken);
        if (excluded)
            return Result.Failure<RecordObjectiveProgressResponseDto>(Error.Forbidden(
                "ObjectiveProgress.ExcludedForbidden",
                "You were excluded from this campaign's planning, so it has no progress to record."));

        var cycle = await dbContext.PerformanceCycles
            .FirstOrDefaultAsync(item => item.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<RecordObjectiveProgressResponseDto>(Error.NotFound("PerformanceCycle", request.CycleId));

        var plan = await dbContext.EmployeeObjectivePlans
            .Include(item => item.Objectives)
            .FirstOrDefaultAsync(
                item => item.CycleId == request.CycleId && item.EmployeeId == participant.EmployeeId,
                cancellationToken);
        if (plan is null)
            return Result.Failure<RecordObjectiveProgressResponseDto>(Error.NotFound("EmployeeObjectivePlan", request.CycleId));

        if (plan.Version != request.ExpectedVersion)
            return Result.Success(Conflict(plan.Version));

        var latestByObjective = await ObjectiveProgressQueries.GetLatestByObjectiveAsync(
            dbContext, [plan.Id], cancellationToken);
        latestByObjective.TryGetValue(request.ObjectiveId, out var latest);

        var actorName = string.IsNullOrWhiteSpace(currentUser.FullName) ? participant.FullName : currentUser.FullName!;
        ObjectiveProgressRecordResult recorded;
        try
        {
            recorded = plan.RecordProgress(
                cycle,
                request.ObjectiveId,
                request.Request.ProgressPercent,
                latest?.Percent,
                request.Request.ActualValue,
                request.Request.Comment,
                request.Request.RegressionConfirmed,
                request.Request.RegressionReason,
                new ObjectiveProgressActor(actorUserId, actorName),
                DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<RecordObjectiveProgressResponseDto>(
                Error.Validation("ObjectiveProgress.Invalid", exception.Message));
        }

        if (!recorded.Succeeded)
        {
            return Result.Success(new RecordObjectiveProgressResponseDto(
                false,
                RecordObjectiveProgressOutcomes.Blocked,
                false,
                null,
                null,
                plan.Version,
                recorded.BlockingReasons
                    .Select(reason => new ObjectivePlanBlockingReasonDto(reason.Code, reason.Message, reason.ObjectiveId))
                    .ToList()));
        }

        var update = recorded.Update!;
        var evidenceResult = await ClaimEvidenceAsync(update, request.Request.AttachmentIds, cancellationToken);
        if (evidenceResult.IsFailure)
            return Result.Failure<RecordObjectiveProgressResponseDto>(evidenceResult.Error);

        dbContext.ObjectiveProgressUpdates.Add(update);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            dbContext.ChangeTracker.Clear();
            var refreshedVersion = await dbContext.EmployeeObjectivePlans
                .AsNoTracking()
                .Where(item => item.Id == plan.Id)
                .Select(item => item.Version)
                .SingleAsync(cancellationToken);
            return Result.Success(Conflict(refreshedVersion));
        }

        latestByObjective[update.ObjectiveId] = new LatestObjectiveProgress(
            update.ObjectiveId,
            update.ProgressPercent,
            update.RecordedAt,
            update.ActualValue,
            (latest?.UpdateCount ?? 0) + 1,
            update.IsRegression);

        return Result.Success(new RecordObjectiveProgressResponseDto(
            true,
            RecordObjectiveProgressOutcomes.Recorded,
            false,
            new ObjectiveProgressUpdateDto(
                update.Id,
                update.ObjectiveId,
                update.ProgressPercent,
                update.PreviousPercent,
                update.ActualValue,
                update.Comment,
                update.IsRegression,
                update.RegressionReason,
                update.ActorName,
                update.RecordedAt,
                evidenceResult.Value
                    .Select(item => new ObjectiveProgressAttachmentDto(item.Id, item.FileName, item.ContentType, item.SizeBytes))
                    .ToList()),
            ObjectiveProgressRules.BuildPlanProgress(
                plan.Objectives, latestByObjective, cycle.PlanningLockedAt, DateTime.UtcNow),
            plan.Version,
            []));
    }

    private static RecordObjectiveProgressResponseDto Conflict(uint refreshedVersion)
        => new(
            false,
            RecordObjectiveProgressOutcomes.Conflict,
            true,
            null,
            null,
            refreshedVersion,
            [new ObjectivePlanBlockingReasonDto(
                "ObjectiveProgress.ConcurrentUpdate",
                "Progress changed while you were recording. Review the latest value and try again.",
                null)]);

    /// <summary>
    /// Claims the caller's own pending unowned progress-evidence uploads for the new update and
    /// commits them atomically with it. Any id that does not match such an upload rejects the
    /// whole recording — evidence never silently disappears.
    /// </summary>
    private async Task<Result<List<Attachment>>> ClaimEvidenceAsync(
        ObjectiveProgressUpdate update,
        IReadOnlyList<Guid>? attachmentIds,
        CancellationToken cancellationToken)
    {
        var ids = (attachmentIds ?? []).Where(id => id != Guid.Empty).Distinct().ToList();
        if (ids.Count == 0)
            return Result.Success(new List<Attachment>());

        var attachments = await dbContext.Attachments
            .Where(attachment => ids.Contains(attachment.Id)
                                 && attachment.OwnerType == ObjectiveProgressRules.AttachmentOwnerType
                                 && attachment.OwnerId == null
                                 && attachment.Status == AttachmentStatus.Pending
                                 && attachment.UploaderUserId == currentUser.UserId)
            .ToListAsync(cancellationToken);

        if (attachments.Count != ids.Count)
            return Result.Failure<List<Attachment>>(Error.Validation(
                "ObjectiveProgress.EvidenceInvalid",
                "One or more evidence files are missing or unavailable. Re-attach your evidence and try again."));

        var committedAt = DateTime.UtcNow;
        foreach (var attachment in attachments)
        {
            attachment.AssignOwner(update.Id);
            attachment.Commit(committedAt);
            activityLog.Record(
                action: "AttachmentUploaded",
                subjectType: "Attachment",
                subjectId: attachment.Id,
                metadata: new { attachment.OwnerType, attachment.OwnerId, attachment.FileName, attachment.SizeBytes });
        }

        return Result.Success(attachments);
    }
}
