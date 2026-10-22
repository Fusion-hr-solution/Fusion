using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Insights;

public sealed record GetInsightsQuery(Guid CycleId, Guid? UnitId) : IQuery<Result<InsightsDto>>;

public sealed record GetInsightsPeopleQuery(Guid CycleId, string Metric, Guid? UnitId, Guid? ManagerId, int? Level, int Page, int PageSize)
    : IQuery<Result<InsightsPeoplePageDto>>;

/// <summary>
/// The facts Insights counts, one row per participant of the cycle's frozen population (performance-hr-insights):
/// plan state, update recency, owner-set objective status and alignment, and the latest launched round's review.
/// Read inside the tenant filter by a caller the controller has already checked administers cycles.
/// </summary>
internal static class InsightsData
{
    public const int RecentDays = 30;

    public sealed record ReviewFacts(Guid Id, Guid ReviewerId, string ReviewerName, PerformanceReviewState State, DateOnly? ManagerDue,
        DateTime? ManagerSubmittedAt, int? ManagerRating, int? FinalRating, bool CalibrationChanged, DateTime? FinalizedAt, DateTime? AcknowledgedAt)
    {
        public bool Released => State == PerformanceReviewState.Finalized;
        public bool Late(DateOnly today) => ManagerDue is DateOnly due
            && (ManagerSubmittedAt is DateTime submitted ? DateOnly.FromDateTime(submitted) > due : due < today);
        public bool OnTime => ManagerSubmittedAt is DateTime submitted && (ManagerDue is not DateOnly due || DateOnly.FromDateTime(submitted) <= due);
        public bool Raised => CalibrationChanged && FinalRating > ManagerRating;
        public bool Lowered => CalibrationChanged && FinalRating < ManagerRating;
    }

    public sealed record Person(Guid EmployeeId, string Name, string? JobTitle, Guid? UnitId, string UnitName, string? ManagerName,
        Guid? PlanId, PlanLifecycleState? PlanState, DateTime? LastUpdateAt, IReadOnlyList<ObjectiveStatus?> Statuses, int Aligned,
        ReviewFacts? Review)
    {
        public bool Approved => PlanState == PlanLifecycleState.Approved;
        public bool Updated(DateTime since) => Approved && LastUpdateAt >= since;
        public bool AtRiskOrOff => Statuses.Any(s => s is ObjectiveStatus.AtRisk or ObjectiveStatus.OffTrack);
    }

    public sealed record Loaded(PerformanceCycle Cycle, ReviewRound? Round, IReadOnlyList<Person> People, IReadOnlyList<RatingScaleLevel> Scale,
        GoalsComposer.Graph Graph, IReadOnlyList<Objective> CompanyObjectives, IReadOnlyDictionary<Guid, Guid?> CompanyOf);

    public static async Task<Loaded?> LoadAsync(PerformanceDbContext db, ICoreWorkforceClient workforce, Guid cycleId, CancellationToken token)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cycleId, token);
        if (cycle is null || cycle.State == CycleLifecycleState.Draft) return null;

        var participants = await db.Participants.AsNoTracking().Where(p => p.CycleId == cycleId)
            .Select(p => new { p.EmployeeId, p.DisplayName, p.JobTitle, p.OrgUnitId, p.OrgUnitName, p.ManagerDisplayName })
            .ToListAsync(token);
        var plans = (await db.EmployeePlans.AsNoTracking().Where(p => p.CycleId == cycleId)
                .Select(p => new { p.Id, p.EmployeeId, p.State }).ToListAsync(token))
            .GroupBy(p => p.EmployeeId).ToDictionary(g => g.Key, g => g.First());

        // The whole cycle's objective graph as administration sees it: owner-set status, alignment up to the company.
        var graph = await GoalsComposer.LoadGraphAsync(db, workforce, cycle, token,
            new CycleViewer(new Goals.GoalActorContext(Guid.Empty, true, HasOrgManageGrant: false, CanReviewReports: false), null));
        var companyOf = new Dictionary<Guid, Guid?>();
        Guid? CompanyOf(Objective objective)
        {
            if (companyOf.TryGetValue(objective.Id, out var known)) return known;
            var seen = new HashSet<Guid>();
            var current = objective;
            Guid? found = null;
            while (current.ParentObjectiveId is Guid parentId && seen.Add(parentId) && graph.ById.TryGetValue(parentId, out var parent))
            {
                if (parent.OwnershipScope == ObjectiveOwnershipScope.Company) { found = parent.Id; break; }
                current = parent;
            }
            companyOf[objective.Id] = found;
            return found;
        }
        var byPlan = graph.All.Where(o => o.EmployeePlanId != null && o.State != ObjectiveLifecycleState.Archived)
            .GroupBy(o => o.EmployeePlanId!.Value).ToDictionary(g => g.Key, g => g.ToList());

        var round = await db.ReviewRounds.AsNoTracking()
            .Where(r => r.CycleId == cycleId && r.LaunchedAt != null)
            .OrderByDescending(r => r.LaunchedAt).FirstOrDefaultAsync(token);
        var reviews = new Dictionary<Guid, ReviewFacts>();
        IReadOnlyList<RatingScaleLevel> scale = [];
        if (round is not null)
        {
            var rows = await db.PerformanceReviews.AsNoTracking()
                .Where(r => r.ReviewRoundId == round.Id && r.State != PerformanceReviewState.Closed)
                .Select(r => new
                {
                    r.Id, r.SubjectEmployeeId, r.ReviewerEmployeeId, r.ReviewerDisplayName, r.State,
                    Due = r.ManagerAssessmentDueDate ?? round.ManagerAssessmentDueDate,
                    r.ManagerAssessment.SubmittedAt, Manager = r.ManagerAssessment.OverallRating,
                    r.FinalRating, r.CalibrationChangedRating, r.FinalizedAt, r.AcknowledgedAt, r.RatingScaleSnapshotJson,
                })
                .ToListAsync(token);
            foreach (var r in rows)
                reviews[r.SubjectEmployeeId] = new ReviewFacts(r.Id, r.ReviewerEmployeeId, r.ReviewerDisplayName, r.State, r.Due, r.SubmittedAt,
                    r.Manager, r.FinalRating, r.CalibrationChangedRating, r.FinalizedAt, r.AcknowledgedAt);
            scale = rows.Select(r => r.RatingScaleSnapshotJson).FirstOrDefault() is string json
                ? JsonSerializer.Deserialize<RatingScaleLevel[]>(json) ?? []
                : [];
        }

        static DateTime? CheckIn(Objective o) => o.LastCheckInAt;
        var people = participants.Select(p =>
        {
            var plan = plans.GetValueOrDefault(p.EmployeeId);
            var objectives = plan is not null && plan.State == PlanLifecycleState.Approved ? byPlan.GetValueOrDefault(plan.Id) ?? [] : [];
            return new Person(p.EmployeeId, p.DisplayName, p.JobTitle, p.OrgUnitId, p.OrgUnitName ?? "No unit", p.ManagerDisplayName,
                plan?.Id, plan?.State, objectives.Select(CheckIn).Where(d => d is not null).Max(),
                objectives.Select(o => o.CurrentStatus).ToList(), objectives.Count(o => CompanyOf(o) is not null),
                reviews.GetValueOrDefault(p.EmployeeId));
        }).ToList();

        var company = graph.All.Where(o => o.OwnershipScope == ObjectiveOwnershipScope.Company && o.State == ObjectiveLifecycleState.Published)
            .OrderBy(o => o.Title).ToList();
        foreach (var objective in graph.All.Where(o => o.EmployeePlanId != null)) CompanyOf(objective);
        return new Loaded(cycle, round, people, scale, graph, company, companyOf);
    }

    /// <summary>The units in the filter: the unit itself and every unit below it, from Core HR's structure.</summary>
    public static async Task<(HashSet<Guid>? Scope, string Name, IReadOnlyList<InsightsUnitOptionDto> Options)> ScopeAsync(
        ICoreWorkforceClient workforce, IReadOnlyList<Person> people, Guid? unitId, CancellationToken token)
    {
        var populationUnits = people.Where(p => p.UnitId is not null).Select(p => p.UnitId!.Value).Distinct().ToList();
        IReadOnlyList<Infrastructure.Core.WorkforceOrgUnitContext> contexts = [];
        try
        {
            if (populationUnits.Count > 0)
            {
                contexts = await workforce.ResolveOrgUnitsAsync(PerformanceClock.UtcNow, populationUnits, token);
                var ancestors = contexts.SelectMany(c => c.AncestorOrgUnitIds).Distinct().Except(populationUnits).ToList();
                if (ancestors.Count > 0)
                    contexts = [.. contexts, .. await workforce.ResolveOrgUnitsAsync(PerformanceClock.UtcNow, ancestors, token)];
            }
        }
        catch (HttpRequestException)
        {
            // Core HR down: each unit filters to itself only; names come from the population.
            contexts = [];
        }

        var names = people.Where(p => p.UnitId is not null).GroupBy(p => p.UnitId!.Value).ToDictionary(g => g.Key, g => g.First().UnitName);
        foreach (var context in contexts) names[context.OrgUnitId] = context.Name;
        var ancestorsOf = contexts.GroupBy(c => c.OrgUnitId).ToDictionary(g => g.Key, g => g.First().AncestorOrgUnitIds);
        var options = names.Select(n => new InsightsUnitOptionDto(n.Key, n.Value, ancestorsOf.GetValueOrDefault(n.Key)?.Count ?? 0))
            .OrderBy(o => o.Depth).ThenBy(o => o.Name).ToList();

        if (unitId is not Guid filter) return (null, "All units", options);
        var scope = populationUnits.Where(u => u == filter || (ancestorsOf.GetValueOrDefault(u)?.Contains(filter) ?? false)).ToHashSet();
        return (scope, names.GetValueOrDefault(filter) ?? "Unit", options);
    }

    public static bool InScope(Person person, HashSet<Guid>? scope) => scope is null || (person.UnitId is Guid unit && scope.Contains(unit));
}

/// <summary>
/// Cycle › Insights (performance-hr-insights, D-33): counts and shares by unit and by manager for cycle administrators,
/// with the sections the phase has facts for, ordered by what needs attention, plus an all-units total row.
/// </summary>
public sealed class GetInsightsHandler(PerformanceDbContext db, ICoreWorkforceClient workforce)
    : IQueryHandler<GetInsightsQuery, Result<InsightsDto>>
{
    public async Task<Result<InsightsDto>> Handle(GetInsightsQuery request, CancellationToken cancellationToken)
    {
        var data = await InsightsData.LoadAsync(db, workforce, request.CycleId, cancellationToken);
        if (data is null) return Result.Failure<InsightsDto>(PerformanceErrors.NotFound("Cycle", request.CycleId));
        var (scope, scopeName, options) = await InsightsData.ScopeAsync(workforce, data.People, request.UnitId, cancellationToken);
        var people = data.People.Where(p => InsightsData.InScope(p, scope)).ToList();

        var cycle = data.Cycle;
        var today = PerformanceClock.Today;
        var since = PerformanceClock.UtcNow.AddDays(-InsightsData.RecentDays);
        var execution = cycle.State == CycleLifecycleState.Closed || today > cycle.PlanningDeadline;
        var reviews = data.Round is not null && people.Any(p => p.Review is not null);

        InsightsRowDto Row(Guid? unitId, string name, IReadOnlyList<InsightsData.Person> group)
        {
            var approved = group.Where(p => p.Approved).ToList();
            var withReview = group.Where(p => p.Review is not null).Select(p => p.Review!).ToList();
            var released = withReview.Where(r => r.Released).ToList();
            return new InsightsRowDto(unitId, name, group.Count,
                approved.Count,
                execution ? approved.Count : null,
                execution ? approved.Count(p => p.Updated(since)) : null,
                execution ? Mix(approved.SelectMany(p => p.Statuses)) : null,
                execution ? approved.Sum(p => p.Statuses.Count) : null,
                execution ? approved.Sum(p => p.Aligned) : null,
                reviews ? withReview.Count : null,
                reviews ? withReview.Count(r => r.OnTime) : null,
                reviews ? withReview.Count(r => r.Late(today)) : null,
                reviews ? released.Count : null,
                reviews ? released.Count(r => r.AcknowledgedAt is not null) : null,
                reviews && released.Count > 0 ? Levels(data.Scale, released) : null,
                reviews ? released.Count(r => r.Raised) : null,
                reviews ? released.Count(r => r.Lowered) : null);
        }

        var byUnit = people.GroupBy(p => (p.UnitId, p.UnitName)).Select(g => Row(g.Key.UnitId, g.Key.UnitName, g.ToList())).ToList();
        // Units furthest behind first for the phase's question; ties by size, then name.
        IOrderedEnumerable<InsightsRowDto> ordered = reviews
            ? byUnit.OrderByDescending(u => u.Late).ThenBy(u => Share(u.Acknowledged, u.Released))
            : execution
                ? byUnit.OrderBy(u => Share(u.UpdatedIn30Days, u.ApprovedPlans)).ThenByDescending(u => u.People)
                : byUnit.OrderBy(u => Share(u.PlansApproved, u.People)).ThenByDescending(u => u.People);
        byUnit = ordered.ThenBy(u => u.Name).ToList();

        var managers = reviews
            ? people.Where(p => p.Review is not null).GroupBy(p => (p.Review!.ReviewerId, p.Review.ReviewerName))
                .Select(g =>
                {
                    var unitName = data.People.FirstOrDefault(p => p.EmployeeId == g.Key.ReviewerId)?.UnitName;
                    var released = g.Where(p => p.Review!.Released).ToList();
                    return new InsightsManagerDto(g.Key.ReviewerId, g.Key.ReviewerName, unitName, g.Count(),
                        g.Count(p => p.Review!.Late(today)), released.Count, released.Count(p => p.Review!.AcknowledgedAt is not null));
                })
                .OrderByDescending(m => m.Late).ThenBy(m => Share(m.Acknowledged, m.Released)).ThenBy(m => m.Name).ToList()
            : [];

        var direction = new List<InsightsDirectionDto>();
        var notAligned = 0;
        if (execution)
        {
            var approvedPlanIds = people.Where(p => p.Approved && p.PlanId is not null).Select(p => p.PlanId!.Value).ToHashSet();
            var unitByPlan = people.Where(p => p.PlanId is not null).ToDictionary(p => p.PlanId!.Value, p => p.UnitId);
            var planObjectives = data.Graph.All.Where(o => o.EmployeePlanId is Guid planId && approvedPlanIds.Contains(planId)
                && o.State != ObjectiveLifecycleState.Archived).ToList();
            var unitCount = people.Select(p => p.UnitId).Distinct().Count();
            foreach (var company in data.CompanyObjectives)
            {
                var aligned = planObjectives.Where(o => data.CompanyOf.GetValueOrDefault(o.Id) == company.Id).ToList();
                var node = GoalsComposer.ToNode(company, data.Graph);
                direction.Add(new InsightsDirectionDto(company.Id, company.Title, node.AccountablePersonName, aligned.Count,
                    aligned.Select(o => unitByPlan.GetValueOrDefault(o.EmployeePlanId!.Value)).Distinct().Count(), unitCount,
                    node.DerivedProgress, node.HasProgress));
            }
            notAligned = planObjectives.Count(o => data.CompanyOf.GetValueOrDefault(o.Id) is null);
        }

        var releasedAll = people.Where(p => p.Review?.Released == true).ToList();
        return Result.Success(new InsightsDto(
            cycle.Id, cycle.Name, cycle.State, today, cycle.State == CycleLifecycleState.Closed, people.Count,
            scope is null ? null : request.UnitId, scopeName, options,
            execution, reviews, data.Round?.Id, data.Round?.Name, data.Round?.ManagerAssessmentDueDate,
            releasedAll.Max(p => p.Review!.FinalizedAt),
            people.Count(p => !p.Approved),
            people.Count(p => p.Approved && !p.Updated(since)),
            byUnit, Row(null, scope is null ? "All units" : scopeName, people),
            direction, notAligned, managers));
    }

    private static double Share(int? count, int? total) => total is > 0 ? (double)(count ?? 0) / total.Value : 1d;

    private static StatusMixDto Mix(IEnumerable<ObjectiveStatus?> statuses)
    {
        var list = statuses.ToList();
        return new StatusMixDto(list.Count(s => s == ObjectiveStatus.OnTrack), list.Count(s => s == ObjectiveStatus.AtRisk),
            list.Count(s => s == ObjectiveStatus.OffTrack), list.Count(s => s is null));
    }

    private static IReadOnlyList<LevelCountDto> Levels(IReadOnlyList<RatingScaleLevel> scale, IReadOnlyList<InsightsData.ReviewFacts> released)
        => scale.Select(level => new LevelCountDto(level.Value, level.Label, released.Count(r => r.FinalRating == level.Value)))
            .Concat(released.Where(r => r.FinalRating is int value && scale.All(l => l.Value != value))
                .GroupBy(r => r.FinalRating!.Value).Select(g => new LevelCountDto(g.Key, $"Level {g.Key}", g.Count())))
            .OrderBy(l => l.Value).ToList();
}

/// <summary>The participants behind one Insights figure, paged on the server; each opens their plan or review.</summary>
public sealed class GetInsightsPeopleHandler(PerformanceDbContext db, ICoreWorkforceClient workforce)
    : IQueryHandler<GetInsightsPeopleQuery, Result<InsightsPeoplePageDto>>
{
    public const int MaxPageSize = 50;

    public static readonly IReadOnlySet<string> Metrics = new HashSet<string>
    {
        "people", "plans-approved", "plans-not-approved", "updated", "not-updated", "at-risk-or-off-track",
        "reviews", "on-time", "late", "released", "acknowledged", "not-acknowledged", "level", "raised", "lowered",
    };

    public async Task<Result<InsightsPeoplePageDto>> Handle(GetInsightsPeopleQuery request, CancellationToken cancellationToken)
    {
        if (!Metrics.Contains(request.Metric) || (request.Metric == "level" && request.Level is null))
            return Result.Failure<InsightsPeoplePageDto>(PerformanceErrors.Validation("Insights.Invalid", "Choose a figure to open."));
        var data = await InsightsData.LoadAsync(db, workforce, request.CycleId, cancellationToken);
        if (data is null) return Result.Failure<InsightsPeoplePageDto>(PerformanceErrors.NotFound("Cycle", request.CycleId));
        var (scope, _, _) = await InsightsData.ScopeAsync(workforce, data.People, request.UnitId, cancellationToken);

        var today = PerformanceClock.Today;
        var since = PerformanceClock.UtcNow.AddDays(-InsightsData.RecentDays);
        bool Matches(InsightsData.Person p) => request.Metric switch
        {
            "people" => true,
            "plans-approved" => p.Approved,
            "plans-not-approved" => !p.Approved,
            "updated" => p.Updated(since),
            "not-updated" => p.Approved && !p.Updated(since),
            "at-risk-or-off-track" => p.Approved && p.AtRiskOrOff,
            "reviews" => p.Review is not null,
            "on-time" => p.Review?.OnTime == true,
            "late" => p.Review?.Late(today) == true,
            "released" => p.Review?.Released == true,
            "acknowledged" => p.Review is { Released: true, AcknowledgedAt: not null },
            "not-acknowledged" => p.Review is { Released: true, AcknowledgedAt: null },
            "level" => p.Review is { Released: true } review && review.FinalRating == request.Level,
            "raised" => p.Review is { Released: true, Raised: true },
            "lowered" => p.Review is { Released: true, Lowered: true },
            _ => false,
        };

        var matching = data.People
            .Where(p => InsightsData.InScope(p, scope) && (request.ManagerId is not Guid manager || p.Review?.ReviewerId == manager) && Matches(p))
            .OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase).ToList();
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);
        var page = Math.Max(1, request.Page);
        var cycleId = data.Cycle.Id;
        var items = matching.Skip((page - 1) * pageSize).Take(pageSize).Select(p => new InsightsPersonDto(
            p.EmployeeId, p.Name, p.JobTitle, p.UnitName, p.Review?.ReviewerName ?? p.ManagerName,
            p.PlanState switch
            {
                null => RosterPlanStatus.NotStarted,
                PlanLifecycleState.Approved => RosterPlanStatus.Approved,
                PlanLifecycleState.Submitted => RosterPlanStatus.Submitted,
                _ => RosterPlanStatus.Draft,
            },
            p.LastUpdateAt, p.Review?.ManagerDue, p.Review?.ManagerSubmittedAt, p.Review?.FinalizedAt, p.Review?.AcknowledgedAt,
            p.Review?.Released == true ? p.Review.FinalRating : null,
            p.Review?.Released == true && p.Review.CalibrationChanged ? p.Review.ManagerRating : null,
            p.Review is not null && request.Metric is "reviews" or "on-time" or "late" or "released" or "acknowledged" or "not-acknowledged" or "level" or "raised" or "lowered"
                ? PerformanceNotificationTemplates.ReviewPath(p.Review.Id)
                : p.PlanId is Guid planId ? PerformanceNotificationTemplates.PlanPath(cycleId, planId) : null))
            .ToList();
        return Result.Success(new InsightsPeoplePageDto(request.Metric, matching.Count, page, pageSize, items));
    }
}
