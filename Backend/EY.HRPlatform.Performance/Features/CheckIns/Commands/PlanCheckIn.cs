using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.CheckIns.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CheckIns.Commands;

public sealed record PlanCheckInCommand(Guid CycleId, PlanCheckInRequest Request)
    : ICommand<Result<CheckInMutationResult>>;

public sealed class PlanCheckInCommandHandler(
    PerformanceDbContext dbContext,
    CheckInAccessGuard accessGuard,
    ICurrentUserContext currentUser) : ICommandHandler<PlanCheckInCommand, Result<CheckInMutationResult>>
{
    public async Task<Result<CheckInMutationResult>> Handle(
        PlanCheckInCommand request,
        CancellationToken cancellationToken)
    {
        var scopeResult = await accessGuard.RequirePlanScopeAsync(request.CycleId, request.Request.EmployeeId, cancellationToken);
        if (scopeResult.IsFailure)
            return Result.Failure<CheckInMutationResult>(scopeResult.Error);
        var scope = scopeResult.Value;

        var reviewerName = string.IsNullOrWhiteSpace(scope.ReviewerName) ? currentUser.FullName ?? "Reviewer" : scope.ReviewerName;

        PerformanceCheckIn checkIn;
        try
        {
            checkIn = PerformanceCheckIn.Plan(
                scope.Cycle.TenantId,
                scope.Cycle.Id,
                scope.Participant.EmployeeId,
                scope.ReviewerId,
                reviewerName,
                scope.Relationship,
                request.Request.PlannedDate,
                request.Request.PlannedTime,
                request.Request.Reason,
                request.Request.Agenda,
                DateTime.UtcNow);

            var objectiveIds = (request.Request.LinkedObjectiveIds ?? []).Where(id => id != Guid.Empty).Distinct().ToList();
            foreach (var objectiveId in objectiveIds)
            {
                var objective = scope.Plan.Objectives.FirstOrDefault(item => item.Id == objectiveId);
                if (objective is null)
                    return Result.Failure<CheckInMutationResult>(Error.Validation(
                        "CheckIn.LinkedObjectiveInvalid",
                        "A linked objective does not belong to this participant's plan."));
                checkIn.AddLinkedObjective(objective.Id, objective.Title);
            }
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<CheckInMutationResult>(Error.Validation("CheckIn.Invalid", exception.Message));
        }

        var signalIds = (request.Request.DiscussionSignalIds ?? []).Where(id => id != Guid.Empty).Distinct().ToList();
        if (signalIds.Count > 0)
        {
            var signals = await dbContext.ObjectiveDiscussionSignals
                .Where(item => signalIds.Contains(item.Id)
                               && item.CycleId == request.CycleId
                               && item.RaisedByEmployeeId == scope.Participant.EmployeeId
                               && item.Status == DiscussionSignalStatus.Open)
                .ToListAsync(cancellationToken);
            if (signals.Count != signalIds.Count)
                return Result.Failure<CheckInMutationResult>(Error.Validation(
                    "CheckIn.DiscussionSignalInvalid",
                    "A referenced discussion signal is missing or already resolved."));
            foreach (var signal in signals)
                signal.LinkToCheckIn(checkIn.Id);
        }

        dbContext.PerformanceCheckIns.Add(checkIn);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success(new CheckInMutationResult(checkIn.Id, checkIn.Status, checkIn.Version));
    }
}
