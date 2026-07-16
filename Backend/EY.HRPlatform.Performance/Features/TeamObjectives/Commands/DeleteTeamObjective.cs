using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.TeamObjectives.Commands;

/// <summary>
/// Deletes a team objective. Only the owning manager may delete; hard delete is safe in P1.3
/// because employee objectives do not exist yet (P1.4 will FK with Restrict). Always audited.
/// </summary>
public sealed record DeleteTeamObjectiveCommand(
    Guid CycleId,
    Guid ObjectiveId,
    uint ExpectedVersion) : ICommand<Result>;

public sealed class DeleteTeamObjectiveCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : ICommandHandler<DeleteTeamObjectiveCommand, Result>
{
    public async Task<Result> Handle(DeleteTeamObjectiveCommand request, CancellationToken cancellationToken)
    {
        var employeeId = currentUser.EmployeeId;
        if (!employeeId.HasValue)
            return Result.Failure(Error.Forbidden(
                "TeamObjective.EmployeeContextForbidden",
                "Your account is not linked to an employee record, so no campaign names you as responsible."));

        var objective = await dbContext.CampaignTeamObjectives
            .FirstOrDefaultAsync(
                item => item.Id == request.ObjectiveId && item.CycleId == request.CycleId,
                cancellationToken);

        if (objective is null)
            return Result.Failure(Error.NotFound("CampaignTeamObjective", request.ObjectiveId));

        if (objective.OwnerManagerEmployeeId != employeeId.Value)
            return Result.Failure(Error.Forbidden(
                "TeamObjective.NotOwnerForbidden",
                "Only the owning manager can change this team objective."));

        ConcurrencyGuard.Ensure(objective.Version, request.ExpectedVersion, nameof(CampaignTeamObjective), objective.Id);

        dbContext.CampaignTeamObjectives.Remove(objective);
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            objective.TenantId,
            objective.CycleId,
            PerformanceCycleAuditAction.TeamObjectiveDeleted,
            currentUser.UserId,
            currentUser.FullName,
            $"Deleted team objective '{objective.Title}'."));

        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
