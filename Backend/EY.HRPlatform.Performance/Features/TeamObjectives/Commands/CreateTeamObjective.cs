using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.TeamObjectives.Dtos;
using EY.HRPlatform.Performance.Features.TeamObjectives.Queries;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.TeamObjectives.Commands;

/// <summary>
/// Creates a team objective owned by the acting manager in a launched campaign where they are
/// the frozen approver of at least one participant. Saved is the only state — no lifecycle.
/// </summary>
public sealed record CreateTeamObjectiveCommand(
    Guid CycleId,
    Guid StrategicObjectiveId,
    string Title,
    string SuccessCriteria,
    string MeasurementMethod,
    string? Description) : ICommand<Result<TeamObjectiveDto>>;

public sealed class CreateTeamObjectiveCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : ICommandHandler<CreateTeamObjectiveCommand, Result<TeamObjectiveDto>>
{
    public async Task<Result<TeamObjectiveDto>> Handle(
        CreateTeamObjectiveCommand request,
        CancellationToken cancellationToken)
    {
        var employeeId = currentUser.EmployeeId;
        if (!employeeId.HasValue)
            return Result.Failure<TeamObjectiveDto>(Error.Forbidden(
                "TeamObjective.EmployeeContextForbidden",
                "Your account is not linked to an employee record, so no campaign names you as responsible."));

        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Include(c => c.StrategicObjectives)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
            return Result.Failure<TeamObjectiveDto>(Error.NotFound("PerformanceCycle", request.CycleId));

        if (cycle.Status != PerformanceCycleStatus.Launched)
            return Result.Failure<TeamObjectiveDto>(Error.Validation(
                "TeamObjective.NotLaunchedInvalid",
                "This campaign is not launched for objective planning yet."));

        var isResponsible = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .AnyAsync(
                participant => participant.CycleId == cycle.Id && participant.ApproverEmployeeId == employeeId.Value,
                cancellationToken);

        if (!isResponsible)
            return Result.Failure<TeamObjectiveDto>(Error.Forbidden(
                "TeamObjective.NotResponsibleForbidden",
                "This campaign does not name you as responsible for any participants."));

        var strategicObjective = cycle.StrategicObjectives
            .FirstOrDefault(objective => objective.Id == request.StrategicObjectiveId);
        if (strategicObjective is null)
            return Result.Failure<TeamObjectiveDto>(Error.Validation(
                "TeamObjective.StrategicLinkInvalid",
                "The linked strategic objective does not belong to this campaign."));

        CampaignTeamObjective objectiveEntity;
        try
        {
            objectiveEntity = CampaignTeamObjective.Create(
                cycle,
                strategicObjective,
                employeeId.Value,
                currentUser.FullName ?? "Unknown",
                request.Title,
                request.SuccessCriteria,
                request.MeasurementMethod,
                request.Description);
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<TeamObjectiveDto>(
                Error.Validation("TeamObjective.Invalid", exception.Message));
        }

        dbContext.CampaignTeamObjectives.Add(objectiveEntity);
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            cycle.TenantId,
            cycle.Id,
            PerformanceCycleAuditAction.TeamObjectiveCreated,
            currentUser.UserId,
            currentUser.FullName,
            $"Created team objective '{objectiveEntity.Title}' linked to '{strategicObjective.Title}'."));

        await dbContext.SaveChangesAsync(cancellationToken);

        var strategicTitles = cycle.StrategicObjectives.ToDictionary(o => o.Id, o => o.Title);
        return Result.Success(TeamObjectiveMapper.ToDto(objectiveEntity, strategicTitles));
    }
}
