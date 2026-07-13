using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.EmployeeObjectives.Commands;

public sealed record SaveObjectiveCommand(
    Guid CycleId,
    Guid? ObjectiveId,
    uint? ExpectedVersion,
    SaveEmployeeObjectiveRequest Request) : ICommand<Result<EmployeeObjectivePlanDto>>;

public sealed class SaveObjectiveCommandHandler(
    PerformanceDbContext dbContext,
    EmployeeObjectivePlanAccessGuard accessGuard,
    ICurrentUserContext currentUser) : ICommandHandler<SaveObjectiveCommand, Result<EmployeeObjectivePlanDto>>
{
    public async Task<Result<EmployeeObjectivePlanDto>> Handle(
        SaveObjectiveCommand request,
        CancellationToken cancellationToken)
    {
        var participantResult = await accessGuard.RequireParticipantAsync(request.CycleId, cancellationToken);
        if (participantResult.IsFailure)
            return Result.Failure<EmployeeObjectivePlanDto>(participantResult.Error);

        var cycle = await dbContext.PerformanceCycles
            .Include(item => item.StrategicObjectives)
            .FirstOrDefaultAsync(item => item.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<EmployeeObjectivePlanDto>(Error.NotFound("PerformanceCycle", request.CycleId));

        var plan = await GetOrCreatePlanAsync(cycle, participantResult.Value, cancellationToken);
        if (plan.IsFailure)
            return Result.Failure<EmployeeObjectivePlanDto>(plan.Error);

        if (request.ObjectiveId.HasValue)
        {
            if (!request.ExpectedVersion.HasValue)
                return Result.Failure<EmployeeObjectivePlanDto>(Error.Validation(
                    "EmployeeObjectivePlan.VersionRequired",
                    "Refresh the plan before saving this objective."));
            ConcurrencyGuard.Ensure(plan.Value.Version, request.ExpectedVersion.Value, nameof(EmployeeObjectivePlan), plan.Value.Id);
        }

        var alignment = await ResolveAlignmentAsync(cycle, participantResult.Value, request.Request, cancellationToken);
        if (alignment.IsFailure)
            return Result.Failure<EmployeeObjectivePlanDto>(alignment.Error);

        EmployeeObjective? createdObjective = null;
        try
        {
            if (request.ObjectiveId.HasValue)
            {
                plan.Value.UpdateObjective(
                    cycle,
                    request.ObjectiveId.Value,
                    request.Request.Title,
                    request.Request.AlignmentType,
                    request.Request.AlignmentTargetId,
                    alignment.Value,
                    request.Request.Weight,
                    request.Request.Deadline,
                    request.Request.MeasurementMethod,
                    request.Request.MeasurementIndicator,
                    request.Request.TargetValue,
                    request.Request.TargetUnit,
                    DateTime.UtcNow,
                    request.Request.Description,
                    request.Request.SuccessCriteria);
            }
            else
            {
                createdObjective = plan.Value.AddObjective(
                    cycle,
                    request.Request.Title,
                    request.Request.AlignmentType,
                    request.Request.AlignmentTargetId,
                    alignment.Value,
                    request.Request.Weight,
                    request.Request.Deadline,
                    request.Request.MeasurementMethod,
                    request.Request.MeasurementIndicator,
                    request.Request.TargetValue,
                    request.Request.TargetUnit,
                    DateTime.UtcNow,
                    request.Request.Description,
                    request.Request.SuccessCriteria);
            }
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<EmployeeObjectivePlanDto>(
                Error.Validation("EmployeeObjective.Invalid", exception.Message));
        }

        // A newly authored objective carries a client-assigned key. When the plan already exists
        // and is tracked, EF would otherwise infer the child from its set key as an existing row and
        // emit an UPDATE that matches nothing. Mark it Added so it is inserted.
        if (createdObjective is not null)
            dbContext.Entry(createdObjective).State = EntityState.Added;

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            cycle.TenantId,
            cycle.Id,
            request.ObjectiveId.HasValue
                ? PerformanceCycleAuditAction.EmployeeObjectiveUpdated
                : PerformanceCycleAuditAction.EmployeeObjectiveCreated,
            currentUser.UserId,
            currentUser.FullName,
            request.ObjectiveId.HasValue
                ? $"Updated employee objective '{request.Request.Title?.Trim()}'."
                : $"Created employee objective '{request.Request.Title?.Trim()}'."));

        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success(EmployeeObjectivePlanMapper.ToPlanDto(plan.Value));
    }

    private async Task<Result<EmployeeObjectivePlan>> GetOrCreatePlanAsync(
        PerformanceCycle cycle,
        PerformanceCycleParticipant participant,
        CancellationToken cancellationToken)
    {
        var plan = await dbContext.EmployeeObjectivePlans
            .Include(item => item.Objectives)
            .Include(item => item.ReviewEvents)
            .FirstOrDefaultAsync(item => item.CycleId == cycle.Id && item.EmployeeId == participant.EmployeeId, cancellationToken);

        if (plan is not null)
            return Result.Success(plan);

        try
        {
            plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<EmployeeObjectivePlan>(
                Error.Validation("EmployeeObjectivePlan.Invalid", exception.Message));
        }

        dbContext.EmployeeObjectivePlans.Add(plan);
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            cycle.TenantId,
            cycle.Id,
            PerformanceCycleAuditAction.EmployeeObjectivePlanCreated,
            currentUser.UserId,
            currentUser.FullName,
            $"Opened objective plan for '{participant.FullName}'."));
        return Result.Success(plan);
    }

    private async Task<Result<string?>> ResolveAlignmentAsync(
        PerformanceCycle cycle,
        PerformanceCycleParticipant participant,
        SaveEmployeeObjectiveRequest request,
        CancellationToken cancellationToken)
    {
        if (!request.AlignmentType.HasValue && !request.AlignmentTargetId.HasValue)
            return Result.Success<string?>(null);
        if (!request.AlignmentType.HasValue || !request.AlignmentTargetId.HasValue || request.AlignmentTargetId == Guid.Empty)
            return Result.Failure<string?>(Error.Validation(
                "EmployeeObjective.AlignmentInvalid",
                "Choose one alignment target for this objective."));

        if (request.AlignmentType == ObjectiveAlignmentType.StrategicObjective)
        {
            var strategic = cycle.StrategicObjectives.FirstOrDefault(item => item.Id == request.AlignmentTargetId.Value);
            if (strategic is null || !strategic.IsActive)
                return Result.Failure<string?>(Error.Validation(
                    "EmployeeObjective.AlignmentInvalid",
                    "Choose an active strategic objective from this campaign."));

            return Result.Success<string?>(strategic.Title);
        }

        var team = await dbContext.CampaignTeamObjectives
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.Id == request.AlignmentTargetId.Value
                        && item.CycleId == cycle.Id
                        && item.OwnerManagerEmployeeId == participant.ApproverEmployeeId,
                cancellationToken);

        if (team is null)
            return Result.Failure<string?>(Error.Validation(
                "EmployeeObjective.AlignmentInvalid",
                "Choose a team objective owned by your campaign approver."));

        return Result.Success<string?>(team.Title);
    }
}
