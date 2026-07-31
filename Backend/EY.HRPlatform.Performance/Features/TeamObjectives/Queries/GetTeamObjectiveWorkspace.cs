using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.TeamObjectives.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.TeamObjectives.Queries;

/// <summary>
/// The manager's campaign team-objectives workspace: read-only active strategy, the frozen
/// campaign scope they are responsible for, and their own team objectives. Requires frozen
/// responsibility — a Draft campaign has no frozen participants, so it fails closed the same
/// way as no responsibility.
/// </summary>
public sealed record GetTeamObjectiveWorkspaceQuery(string Slug) : IQuery<Result<TeamObjectiveWorkspaceDto>>;

public sealed class GetTeamObjectiveWorkspaceQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : IQueryHandler<GetTeamObjectiveWorkspaceQuery, Result<TeamObjectiveWorkspaceDto>>
{
    public async Task<Result<TeamObjectiveWorkspaceDto>> Handle(
        GetTeamObjectiveWorkspaceQuery request,
        CancellationToken cancellationToken)
    {
        var employeeId = currentUser.EmployeeId;
        if (!employeeId.HasValue)
            return Result.Failure<TeamObjectiveWorkspaceDto>(Error.Forbidden(
                "TeamObjective.EmployeeContextForbidden",
                "Your account is not linked to an employee record, so no campaign names you as responsible."));

        var slug = (request.Slug ?? string.Empty).Trim().ToLowerInvariant();
        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Include(c => c.StrategicObjectives)
            .FirstOrDefaultAsync(c => c.Slug == slug, cancellationToken);

        if (cycle is null)
            return Result.Failure<TeamObjectiveWorkspaceDto>(
                new Error("PerformanceCycle.NotFound", $"Campaign '{slug}' was not found."));

        var myScope = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(participant => participant.CycleId == cycle.Id && participant.ApproverEmployeeId == employeeId.Value)
            .OrderBy(participant => participant.FullName)
            .ToListAsync(cancellationToken);

        if (myScope.Count == 0)
            return Result.Failure<TeamObjectiveWorkspaceDto>(Error.Forbidden(
                "TeamObjective.NotResponsibleForbidden",
                "This campaign does not name you as responsible for any participants."));

        var strategicTitles = cycle.StrategicObjectives.ToDictionary(o => o.Id, o => o.Title);

        var myObjectives = await dbContext.CampaignTeamObjectives
            .AsNoTracking()
            .Where(objective => objective.CycleId == cycle.Id && objective.OwnerManagerEmployeeId == employeeId.Value)
            .OrderBy(objective => objective.CreatedAt)
            .ToListAsync(cancellationToken);

        var workspace = new TeamObjectiveWorkspaceDto(
            cycle.Id,
            cycle.Slug,
            cycle.Name,
            cycle.ReferenceYear,
            cycle.PlanningOpeningDate,
            cycle.EmployeeSubmissionDeadline,
            cycle.ManagerApprovalDeadline,
            cycle.LaunchedAt,
            CampaignTeamObjective.ParseEnabledMeasurementMethods(cycle),
            cycle.StrategicObjectives
                .Where(objective => objective.IsActive)
                .OrderBy(objective => objective.CreatedAt)
                .Select(objective => new TeamObjectiveStrategicObjectiveDto(
                    objective.Id,
                    objective.Title,
                    objective.Description,
                    objective.ResponsibleFunctionLabel))
                .ToList(),
            new TeamObjectiveScopeDto(
                myScope.Count,
                myScope
                    .Select(participant => participant.OrgUnitName)
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .Select(name => name!)
                    .Distinct()
                    .OrderBy(name => name)
                    .ToList(),
                myScope
                    .Select(participant => new TeamObjectiveScopeParticipantDto(
                        participant.EmployeeId,
                        participant.FullName,
                        participant.JobTitle,
                        participant.OrgUnitName))
                    .ToList()),
            myObjectives
                .Select(objective => TeamObjectiveMapper.ToDto(objective, strategicTitles))
                .ToList());

        return Result.Success(workspace);
    }
}

internal static class TeamObjectiveMapper
{
    public static TeamObjectiveDto ToDto(
        CampaignTeamObjective objective,
        IReadOnlyDictionary<Guid, string> strategicTitles)
        => new(
            objective.Id,
            objective.CycleId,
            objective.StrategicObjectiveId,
            strategicTitles.GetValueOrDefault(objective.StrategicObjectiveId, string.Empty),
            objective.OwnerManagerEmployeeId,
            objective.OwnerManagerName,
            objective.Title,
            objective.SuccessCriteria,
            objective.MeasurementMethod,
            objective.Description,
            objective.CreatedAt,
            objective.UpdatedAt,
            objective.Version);
}
