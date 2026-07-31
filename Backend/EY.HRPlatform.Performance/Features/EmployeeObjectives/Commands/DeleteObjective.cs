using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.EmployeeObjectives.Commands;

public sealed record DeleteObjectiveCommand(
    Guid CycleId,
    Guid ObjectiveId,
    uint ExpectedVersion) : ICommand<Result>;

public sealed class DeleteObjectiveCommandHandler(
    PerformanceDbContext dbContext,
    EmployeeObjectivePlanAccessGuard accessGuard,
    Features.Security.ICurrentUserContext currentUser) : ICommandHandler<DeleteObjectiveCommand, Result>
{
    public async Task<Result> Handle(DeleteObjectiveCommand request, CancellationToken cancellationToken)
    {
        var participantResult = await accessGuard.RequireParticipantAsync(request.CycleId, cancellationToken);
        if (participantResult.IsFailure)
            return Result.Failure(participantResult.Error);

        var cycle = await dbContext.PerformanceCycles
            .FirstOrDefaultAsync(item => item.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure(Error.NotFound("PerformanceCycle", request.CycleId));
        if (cycle.IsPlanningLocked)
            return Result.Failure(Error.Conflict(
                "EmployeeObjectivePlan.Locked",
                "Planning is locked for this campaign."));

        var plan = await dbContext.EmployeeObjectivePlans
            .Include(item => item.Objectives)
            .FirstOrDefaultAsync(
                item => item.CycleId == request.CycleId && item.EmployeeId == participantResult.Value.EmployeeId,
                cancellationToken);
        if (plan is null)
            return Result.Failure(Error.NotFound("EmployeeObjectivePlan", request.CycleId));

        ConcurrencyGuard.Ensure(plan.Version, request.ExpectedVersion, nameof(EmployeeObjectivePlan), plan.Id);

        try
        {
            plan.RemoveObjective(request.ObjectiveId, DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure(Error.Validation("EmployeeObjective.Invalid", exception.Message));
        }

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            plan.TenantId,
            plan.CycleId,
            Domain.Enums.PerformanceCycleAuditAction.EmployeeObjectiveDeleted,
            currentUser.UserId,
            currentUser.FullName,
            "Deleted employee objective."));

        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
