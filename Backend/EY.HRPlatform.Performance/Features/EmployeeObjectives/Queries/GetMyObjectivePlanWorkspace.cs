using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.EmployeeObjectives.Queries;

public sealed record GetMyObjectivePlanWorkspaceQuery(string Slug) : IQuery<Result<EmployeeObjectivePlanWorkspaceDto>>;

public sealed class GetMyObjectivePlanWorkspaceQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser,
    EmployeeObjectivePlanAccessGuard accessGuard) : IQueryHandler<GetMyObjectivePlanWorkspaceQuery, Result<EmployeeObjectivePlanWorkspaceDto>>
{
    public async Task<Result<EmployeeObjectivePlanWorkspaceDto>> Handle(
        GetMyObjectivePlanWorkspaceQuery request,
        CancellationToken cancellationToken)
    {
        var employeeId = currentUser.EmployeeId;
        if (!employeeId.HasValue)
            return Result.Failure<EmployeeObjectivePlanWorkspaceDto>(Error.Forbidden(
                "EmployeeObjectivePlan.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));

        var slug = (request.Slug ?? string.Empty).Trim().ToLowerInvariant();
        var cycle = await dbContext.PerformanceCycles
            .Include(cycle => cycle.StrategicObjectives)
            .FirstOrDefaultAsync(cycle => cycle.Slug == slug, cancellationToken);

        if (cycle is null)
            return Result.Failure<EmployeeObjectivePlanWorkspaceDto>(
                new Error("PerformanceCycle.NotFound", $"Campaign '{slug}' was not found."));

        // A closed campaign is read-only, not unreadable: every read still answers with the
        // state as it stood at closure.
        if (!cycle.IsOpenOrClosed())
            return Result.Failure<EmployeeObjectivePlanWorkspaceDto>(Error.Validation(
                "EmployeeObjectivePlan.NotLaunchedInvalid",
                "This campaign is not launched for objective planning yet."));

        var participantResult = await accessGuard.RequireParticipantAsync(cycle.Id, cancellationToken);
        if (participantResult.IsFailure)
            return Result.Failure<EmployeeObjectivePlanWorkspaceDto>(participantResult.Error);
        var participant = participantResult.Value;

        var plan = await dbContext.EmployeeObjectivePlans
            .Include(item => item.Objectives)
            .Include(item => item.ReviewEvents)
            .FirstOrDefaultAsync(
                item => item.CycleId == cycle.Id && item.EmployeeId == employeeId.Value,
                cancellationToken);

        var isEntryOpen = EmployeeObjectivePlanRules.IsEntryOpen(cycle, DateTime.UtcNow);
        if (plan is null && isEntryOpen && !cycle.IsPlanningLocked)
        {
            try
            {
                plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, DateTime.UtcNow);
            }
            catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
            {
                return Result.Failure<EmployeeObjectivePlanWorkspaceDto>(
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
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var state = cycle.IsPlanningLocked
            ? plan?.Status == PlanStatus.Approved ? "locked-approved" : "locked-unresolved"
            : plan?.Status switch
        {
            PlanStatus.Submitted => "submitted",
            PlanStatus.ChangesRequested => "changes-requested",
            PlanStatus.Approved => "approved",
            _ => isEntryOpen
                ? plan is null ? "empty" : "draft"
                : "entry-not-open"
        };

        return Result.Success(await BuildWorkspaceAsync(cycle, participant, plan, state, cancellationToken));
    }

    private async Task<EmployeeObjectivePlanWorkspaceDto> BuildWorkspaceAsync(
        PerformanceCycle cycle,
        PerformanceCycleParticipant participant,
        EmployeeObjectivePlan? plan,
        string state,
        CancellationToken cancellationToken)
    {
        var strategicTitles = cycle.StrategicObjectives.ToDictionary(item => item.Id, item => item.Title);
        var teamOptions = await dbContext.CampaignTeamObjectives
            .AsNoTracking()
            .Where(item => item.CycleId == cycle.Id && item.OwnerManagerEmployeeId == participant.ApproverEmployeeId)
            .OrderBy(item => item.Title)
            .Select(item => new EmployeeObjectiveAlignmentOptionDto(
                ObjectiveAlignmentType.TeamObjective,
                item.Id,
                item.Title,
                item.StrategicObjectiveId,
                strategicTitles.GetValueOrDefault(item.StrategicObjectiveId)))
            .ToListAsync(cancellationToken);

        var strategicOptions = cycle.StrategicObjectives
            .Where(item => item.IsActive)
            .OrderBy(item => item.CreatedAt)
            .Select(item => new EmployeeObjectiveAlignmentOptionDto(
                ObjectiveAlignmentType.StrategicObjective,
                item.Id,
                item.Title,
                item.Id,
                item.Title))
            .ToList();

        // Once planning is locked and the plan is approved, the workspace becomes the living
        // progress record: derived per-objective state, weighted plan progress, and append-only
        // history ride along.
        Progress.Dtos.PlanProgressDto? progress = null;
        var progressHistory = new List<Progress.Dtos.ObjectiveProgressUpdateDto>();
        if (state == "locked-approved" && plan is not null)
        {
            var latestByObjective = await Progress.ObjectiveProgressQueries.GetLatestByObjectiveAsync(
                dbContext, [plan.Id], cancellationToken);
            progress = Progress.ObjectiveProgressRules.BuildPlanProgress(
                plan.Objectives, latestByObjective, cycle.PlanningLockedAt, DateTime.UtcNow);

            var historyByObjective = await new Progress.Queries.ObjectiveProgressHistoryReader(dbContext)
                .GetHistoryByObjectiveAsync([plan.Id], cancellationToken);
            progressHistory = historyByObjective.Values.SelectMany(items => items).ToList();
        }

        return new EmployeeObjectivePlanWorkspaceDto(
            state,
            cycle.Id,
            cycle.Slug,
            cycle.Name,
            cycle.ReferenceYear,
            cycle.PlanningOpeningDate,
            cycle.EmployeeSubmissionDeadline,
            cycle.ManagerApprovalDeadline,
            cycle.LaunchedAt,
            cycle.PlanningLockedAt,
            cycle.PlanningLockedByName,
            cycle.PlanningRulesSnapshot?.MaxObjectiveCount ?? 0,
            EmployeeObjectivePlanRules.AllowedWeights(cycle),
            EmployeeObjectivePlanRules.EnabledMeasurementMethods(cycle),
            plan is null ? null : EmployeeObjectivePlanMapper.ToPlanDto(plan),
            teamOptions.Concat(strategicOptions).ToList(),
            progress,
            progressHistory);
    }
}
