using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.CheckIns.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CheckIns.Commands;

public sealed record CompleteCheckInCommand(Guid CheckInId, CompleteCheckInRequest Request)
    : ICommand<Result<CheckInMutationResult>>;

public sealed class CompleteCheckInCommandHandler(
    PerformanceDbContext dbContext,
    CheckInAccessGuard accessGuard) : ICommandHandler<CompleteCheckInCommand, Result<CheckInMutationResult>>
{
    public async Task<Result<CheckInMutationResult>> Handle(
        CompleteCheckInCommand request,
        CancellationToken cancellationToken)
    {
        var contextResult = await accessGuard.RequireReviewerCheckInAsync(request.CheckInId, cancellationToken);
        if (contextResult.IsFailure)
            return Result.Failure<CheckInMutationResult>(contextResult.Error);
        var context = contextResult.Value;
        var checkIn = context.CheckIn;

        if (checkIn.Version != request.Request.ExpectedVersion)
            return Result.Failure<CheckInMutationResult>(CheckInConflicts.Stale());

        var plan = await dbContext.EmployeeObjectivePlans
            .AsNoTracking()
            .Include(item => item.Objectives)
            .FirstOrDefaultAsync(
                item => item.CycleId == checkIn.CycleId && item.EmployeeId == checkIn.EmployeeId,
                cancellationToken);
        if (plan is null)
            return Result.Failure<CheckInMutationResult>(Error.NotFound("EmployeeObjectivePlan", checkIn.CycleId));
        var objectivesById = plan.Objectives.ToDictionary(objective => objective.Id, objective => objective.Title);

        var participant = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.CycleId == checkIn.CycleId && item.EmployeeId == checkIn.EmployeeId,
                cancellationToken);
        if (participant is null)
            return Result.Failure<CheckInMutationResult>(Error.NotFound("PerformanceCycleParticipant", checkIn.EmployeeId));

        var discussed = new List<CheckInDiscussedObjective>();
        foreach (var objectiveId in (request.Request.DiscussedObjectiveIds ?? []).Where(id => id != Guid.Empty).Distinct())
        {
            if (!objectivesById.TryGetValue(objectiveId, out var title))
                return Result.Failure<CheckInMutationResult>(Error.Validation(
                    "CheckIn.DiscussedObjectiveInvalid",
                    "A discussed objective does not belong to this participant's plan."));
            discussed.Add(new CheckInDiscussedObjective(objectiveId, title));
        }

        var actionInputs = request.Request.Actions ?? [];
        foreach (var action in actionInputs)
        {
            if (action.LinkedObjectiveId is { } linkedId && linkedId != Guid.Empty && !objectivesById.ContainsKey(linkedId))
                return Result.Failure<CheckInMutationResult>(Error.Validation(
                    "CheckIn.ActionObjectiveInvalid",
                    "A follow-up action links an objective that does not belong to this participant's plan."));
        }

        try
        {
            checkIn.Complete(request.Request.Summary, discussed, context.ReviewerId, context.ReviewerName, DateTime.UtcNow);

            foreach (var input in actionInputs)
            {
                var (ownerId, ownerName) = input.OwnerKind == FollowUpActionOwnerKind.Employee
                    ? (checkIn.EmployeeId, participant.FullName)
                    : (context.ReviewerId, context.ReviewerName);

                var action = CheckInFollowUpAction.Create(
                    checkIn.TenantId,
                    checkIn.CycleId,
                    checkIn.Id,
                    checkIn.EmployeeId,
                    input.Description,
                    input.OwnerKind,
                    ownerId,
                    ownerName,
                    input.DueDate,
                    input.LinkedObjectiveId,
                    DateTime.UtcNow);
                dbContext.CheckInFollowUpActions.Add(action);
            }
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<CheckInMutationResult>(Error.Validation("CheckIn.Invalid", exception.Message));
        }

        // Completion resolves any discussion signals linked to this check-in.
        var linkedSignals = await dbContext.ObjectiveDiscussionSignals
            .Where(item => item.LinkedCheckInId == checkIn.Id && item.Status == DiscussionSignalStatus.Open)
            .ToListAsync(cancellationToken);
        foreach (var signal in linkedSignals)
            signal.ResolveByCheckIn(checkIn.Id, DateTime.UtcNow);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<CheckInMutationResult>(CheckInConflicts.Stale());
        }

        return Result.Success(new CheckInMutationResult(checkIn.Id, checkIn.Status, checkIn.Version));
    }
}
