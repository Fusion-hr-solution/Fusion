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
/// Updates a team objective. Only the owning manager may edit; concurrent edits are guarded
/// by the objective's version (If-Match ETag).
/// </summary>
public sealed record UpdateTeamObjectiveCommand(
    Guid CycleId,
    Guid ObjectiveId,
    uint ExpectedVersion,
    Guid StrategicObjectiveId,
    string Title,
    string SuccessCriteria,
    string MeasurementMethod,
    string? Description) : ICommand<Result<TeamObjectiveDto>>;

public sealed class UpdateTeamObjectiveCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : ICommandHandler<UpdateTeamObjectiveCommand, Result<TeamObjectiveDto>>
{
    public async Task<Result<TeamObjectiveDto>> Handle(
        UpdateTeamObjectiveCommand request,
        CancellationToken cancellationToken)
    {
        var employeeId = currentUser.EmployeeId;
        if (!employeeId.HasValue)
            return Result.Failure<TeamObjectiveDto>(Error.Forbidden(
                "TeamObjective.EmployeeContextForbidden",
                "Your account is not linked to an employee record, so no campaign names you as responsible."));

        var objective = await dbContext.CampaignTeamObjectives
            .FirstOrDefaultAsync(
                item => item.Id == request.ObjectiveId && item.CycleId == request.CycleId,
                cancellationToken);

        if (objective is null)
            return Result.Failure<TeamObjectiveDto>(Error.NotFound("CampaignTeamObjective", request.ObjectiveId));

        if (objective.OwnerManagerEmployeeId != employeeId.Value)
            return Result.Failure<TeamObjectiveDto>(Error.Forbidden(
                "TeamObjective.NotOwnerForbidden",
                "Only the owning manager can change this team objective."));

        ConcurrencyGuard.Ensure(objective.Version, request.ExpectedVersion, nameof(CampaignTeamObjective), objective.Id);

        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Include(c => c.StrategicObjectives)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
            return Result.Failure<TeamObjectiveDto>(Error.NotFound("PerformanceCycle", request.CycleId));

        var strategicObjective = cycle.StrategicObjectives
            .FirstOrDefault(item => item.Id == request.StrategicObjectiveId);
        if (strategicObjective is null)
            return Result.Failure<TeamObjectiveDto>(Error.Validation(
                "TeamObjective.StrategicLinkInvalid",
                "The linked strategic objective does not belong to this campaign."));

        var changedFields = CollectChangedFields(objective, request);

        try
        {
            objective.Update(
                cycle,
                strategicObjective,
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

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            cycle.TenantId,
            cycle.Id,
            PerformanceCycleAuditAction.TeamObjectiveUpdated,
            currentUser.UserId,
            currentUser.FullName,
            changedFields.Count == 0
                ? $"Updated team objective '{objective.Title}'."
                : $"Updated team objective '{objective.Title}': {string.Join(", ", changedFields)}."));

        await dbContext.SaveChangesAsync(cancellationToken);

        var strategicTitles = cycle.StrategicObjectives.ToDictionary(o => o.Id, o => o.Title);
        return Result.Success(TeamObjectiveMapper.ToDto(objective, strategicTitles));
    }

    private static List<string> CollectChangedFields(CampaignTeamObjective objective, UpdateTeamObjectiveCommand request)
    {
        var changed = new List<string>();
        if (!string.Equals(objective.Title, request.Title?.Trim(), StringComparison.Ordinal))
            changed.Add("title");
        if (objective.StrategicObjectiveId != request.StrategicObjectiveId)
            changed.Add("strategic objective");
        if (!string.Equals(objective.SuccessCriteria, request.SuccessCriteria?.Trim(), StringComparison.Ordinal))
            changed.Add("success criteria");
        if (!string.Equals(objective.MeasurementMethod, request.MeasurementMethod?.Trim(), StringComparison.OrdinalIgnoreCase))
            changed.Add("measurement method");

        var requestedDescription = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        if (!string.Equals(objective.Description, requestedDescription, StringComparison.Ordinal))
            changed.Add("description");

        return changed;
    }
}
