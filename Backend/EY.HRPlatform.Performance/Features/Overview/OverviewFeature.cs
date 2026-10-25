using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Infrastructure.Ai;
using EY.HRPlatform.Performance.Domain.Conversations;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Development;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Cycles;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Features.Plans;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Settings;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Features.Work;
using EY.HRPlatform.Performance.Features.Workspace;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Overview;

public sealed record GetOverviewQuery(Guid? CycleId, WorkspaceGrants Grants, PlanActorContext Actor) : IQuery<Result<OverviewDto>>;

/// <summary>
/// Overview as one authorized projection (performance-overview): the selected Cycle's year, then rows in a fixed order.
/// Capabilities and recorded responsibility come from the workspace context, so a participant, a reviewer and an
/// administrator — or one person who is all three — simply get the union. Team facts cover only recorded
/// responsibility; the cycle row is administration's tenant view. Every figure is a count, a state or a date.
/// </summary>
public sealed class GetOverviewHandler(PerformanceDbContext db, PerformanceViewer viewer, ICoreWorkforceClient workforce, IPerformanceAiProvider ai)
    : IQueryHandler<GetOverviewQuery, Result<OverviewDto>>
{
    private const int ListedObjectives = 3;
    private const int Chips = 6;
    private const int RecentDays = 30;

    public async Task<Result<OverviewDto>> Handle(GetOverviewQuery request, CancellationToken cancellationToken)
    {
        var context = await new GetWorkspaceContextHandler(db, viewer, ai)
            .Handle(new GetWorkspaceContextQuery(request.CycleId, request.Grants), cancellationToken);
        if (context.IsFailure) return Result.Failure<OverviewDto>(context.Error);
        var ctx = context.Value;
        var caps = ctx.Capabilities;
        var me = request.Actor.CallerEmployeeId;
        var rows = new List<OverviewRowDto>();

        if (ctx.Selected is null)
        {
            rows.Add(new NoCycleRowDto(caps.Administers, caps.Administers ? await NoCycleReadinessAsync(cancellationToken) : null));
            if (await ConversationsAsync(me, cancellationToken) is { } none) rows.Add(none);
            return new OverviewDto(null, null, null, rows, ctx.Destinations);
        }

        var cycle = await db.Cycles.AsNoTracking().FirstAsync(c => c.Id == ctx.Selected.Id, cancellationToken);
        var rounds = await db.ReviewRounds.AsNoTracking().Where(r => r.CycleId == cycle.Id).ToListAsync(cancellationToken);
        var active = rounds.Where(r => r.State == ReviewRoundState.Active).OrderByDescending(r => r.LaunchedAt).FirstOrDefault();
        var today = PerformanceClock.Today;
        var dates = new List<YearDateDto>();

        if (cycle.State == CycleLifecycleState.Draft)
        {
            // Only administrators see a Draft (the workspace context keeps it from everyone else).
            rows.Add(await CycleRowAsync(cycle, null, request.Actor, today, cancellationToken));
            if (await ConversationsAsync(me, cancellationToken) is { } draftConversations) rows.Add(draftConversations);
            dates.Add(new("cycle-start", cycle.StartDate));
            return new OverviewDto(ctx.Selected, ctx.Phase, Year(cycle, rounds, active, dates, today), rows, ctx.Destinations);
        }

        if (caps.Administers)
        {
            var next = await NextCycleAsync(cycle, cancellationToken);
            if (cycle.State == CycleLifecycleState.Closed) rows.Add(next ?? new NextCycleRowDto(null, null, null, null));
            var cycleRow = await CycleRowAsync(cycle, active, request.Actor, today, cancellationToken);
            rows.Add(cycleRow);
            if (cycleRow.Review is { } review && review.ManagerDue is DateOnly managersDue)
                dates.Add(new("managers-due", managersDue, review.ManagerTotal - review.ManagerSubmitted));
            if (cycle.State == CycleLifecycleState.Active && next is not null) rows.Add(next);
        }
        if (cycle.State == CycleLifecycleState.Active && await PlansDueConcernsAsync(cycle, caps, me, cancellationToken))
            dates.Add(new("plans-due", cycle.PlanningDeadline));

        // Reviews you write lead during a round; the team then follows your own review (boards 14, 20).
        var reviewsYouWrite = active is not null && caps.HasReviewWork && me != Guid.Empty
            ? await ReviewsYouWriteAsync(active, me, request.Actor, cancellationToken)
            : null;
        TeamRowDto? team = caps.IsResponsibleReviewer && me != Guid.Empty
            ? await TeamAsync(cycle, active, request.Actor, cancellationToken)
            : null;
        if (reviewsYouWrite is not null)
        {
            rows.Add(reviewsYouWrite);
            if (reviewsYouWrite.DueDate is DateOnly reviewsDue) dates.Add(new("reviews-due", reviewsDue, reviewsYouWrite.Total - reviewsYouWrite.Submitted));
        }
        else if (team is not null) rows.Add(team);

        if (caps.Participates && me != Guid.Empty)
        {
            var ownReview = await OwnReviewAsync(cycle, me, cancellationToken);
            if (ownReview is not null)
            {
                rows.Add(ownReview);
                if (ownReview.Result is null && ownReview.State == PerformanceReviewState.SelfAssessment && ownReview.DueDate is DateOnly selfDue)
                    dates.Add(new("self-due", selfDue));
            }
            if (await InputOwedAsync(cycle, me, cancellationToken) is { } input)
            {
                rows.Add(input);
                if (input.Requests.Select(r => r.DueDate).Where(d => d is not null).Min() is DateOnly peersDue) dates.Add(new("peers-due", peersDue));
            }
            if (cycle.State == CycleLifecycleState.Active) rows.Add(await OwnPlanAsync(cycle, me, today, cancellationToken));
        }
        else if (me != Guid.Empty)
        {
            rows.Add(await NotParticipantAsync(cycle, me, today, cancellationToken));
        }

        if (reviewsYouWrite is not null && team is not null) rows.Add(team);

        if (caps.Participates && me != Guid.Empty && await DevelopmentAsync(cycle, me, cancellationToken) is { } development)
            rows.Add(development);
        if (await ConversationsAsync(me, cancellationToken) is { } conversations) rows.Add(conversations);
        if (await DirectionAsync(cycle, request.Actor, cancellationToken) is { } direction) rows.Add(direction);

        dates.Add(new("cycle-end", cycle.EndDate));
        return new OverviewDto(ctx.Selected, ctx.Phase, Year(cycle, rounds, active, dates, today), rows, ctx.Destinations);
    }

    /// <summary>
    /// The planning deadline is the viewer's date while it still asks something of them: administrators always; a
    /// reviewer while someone they review has no approved plan; a participant until their own plan is submitted.
    /// </summary>
    private async Task<bool> PlansDueConcernsAsync(PerformanceCycle cycle, WorkspaceCapabilitiesDto caps, Guid me, CancellationToken cancellationToken)
    {
        if (caps.Administers) return true;
        if (me == Guid.Empty) return false;
        if (caps.Participates && !await db.EmployeePlans.AsNoTracking().AnyAsync(p => p.CycleId == cycle.Id && p.EmployeeId == me
                && (p.State == PlanLifecycleState.Submitted || p.State == PlanLifecycleState.Approved), cancellationToken))
            return true;
        return caps.IsResponsibleReviewer && await db.Participants.AsNoTracking()
            .Where(p => p.CycleId == cycle.Id && p.ManagerEmployeeId == me)
            .AnyAsync(p => !db.EmployeePlans.Any(plan => plan.CycleId == cycle.Id && plan.EmployeeId == p.EmployeeId
                && plan.State == PlanLifecycleState.Approved), cancellationToken);
    }

    /// <summary>What the first cycle would start from (board 16). Core HR being down leaves only the Performance facts.</summary>
    private async Task<NoCycleReadinessDto> NoCycleReadinessAsync(CancellationToken cancellationToken)
    {
        var levels = RatingScaleDefaults.Levels.Count;
        var scale = await db.RatingScales.AsNoTracking().SingleOrDefaultAsync(cancellationToken);
        if (scale?.CurrentVersionId is Guid versionId
            && await db.RatingScaleVersions.AsNoTracking().FirstOrDefaultAsync(v => v.Id == versionId, cancellationToken) is { } version)
            levels = version.Levels.Count;
        var competencies = await db.Competencies.AsNoTracking().CountAsync(c => c.State == CompetencyState.Active, cancellationToken);
        try
        {
            var people = await workforce.GetAllActiveAsOfAsync(PerformanceClock.Today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc), cancellationToken);
            var withoutManager = people.Where(p => p.Manager is null).OrderBy(p => p.DisplayName).ToList();
            var units = people.Where(p => p.OrgUnit is not null).Select(p => p.OrgUnit!.OrgUnitId).Distinct().Count();
            return new NoCycleReadinessDto(true, people.Count, people.Count - withoutManager.Count,
                withoutManager.Take(3).Select(p => p.DisplayName).ToList(), units, levels, competencies);
        }
        catch (HttpRequestException)
        {
            return new NoCycleReadinessDto(false, 0, 0, [], 0, levels, competencies);
        }
    }

    // ── The year ─────────────────────────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Phases sized by their dates: Planning to the deadline, Review from the first launched round (else the cycle's
    /// last 30 days, estimated), Execution between. The next date is the viewer's earliest from today, else the end.
    /// </summary>
    public static OverviewYearDto Year(PerformanceCycle cycle, IReadOnlyCollection<ReviewRound> rounds, ReviewRound? active,
        IReadOnlyList<YearDateDto> dates, DateOnly today)
    {
        var launched = rounds.Where(r => r.LaunchedAt is not null).Select(r => DateOnly.FromDateTime(r.LaunchedAt!.Value)).DefaultIfEmpty().Min();
        var estimated = launched == default;
        var reviewStart = estimated ? cycle.EndDate.AddDays(-29) : launched;
        var planningEnd = cycle.PlanningDeadline < cycle.StartDate ? cycle.StartDate : cycle.PlanningDeadline;
        // A round launched before planning closed starts Review that day: Planning ends the day before, no Execution.
        if (!estimated && reviewStart > cycle.StartDate && reviewStart <= planningEnd) planningEnd = reviewStart.AddDays(-1);
        if (reviewStart <= planningEnd) reviewStart = planningEnd.AddDays(1);
        if (reviewStart > cycle.EndDate) reviewStart = cycle.EndDate;

        var spans = new (string Name, DateOnly Start, DateOnly End, bool Estimated)[]
        {
            ("Planning", cycle.StartDate, planningEnd, false),
            ("Execution", planningEnd.AddDays(1), reviewStart.AddDays(-1), estimated),
            ("Review", reviewStart, cycle.EndDate, estimated),
        }.Where(s => s.End >= s.Start).ToArray();
        string? current = cycle.State switch
        {
            CycleLifecycleState.Draft => "Draft",
            CycleLifecycleState.Closed => null,
            _ => active is not null ? "Review" : spans.FirstOrDefault(s => today >= s.Start && today <= s.End).Name,
        };
        var phases = spans.Select(s => new YearPhaseDto(s.Name, s.Start, s.End,
            cycle.State switch
            {
                CycleLifecycleState.Closed => YearPhaseState.Done,
                CycleLifecycleState.Draft => YearPhaseState.Upcoming,
                _ when s.Name == current => YearPhaseState.Current,
                _ => today > s.End ? YearPhaseState.Done : YearPhaseState.Upcoming,
            }, s.Estimated)).ToList();

        var ordered = dates.OrderBy(d => d.Date).ToList();
        var next = cycle.State == CycleLifecycleState.Closed ? null
            : ordered.FirstOrDefault(d => d.Date >= today && d.Kind != "cycle-end") ?? ordered.FirstOrDefault(d => d.Kind == "cycle-end");
        int? daysLeft = next is null || next.Date < today ? null : next.Date.DayNumber - today.DayNumber;
        return new OverviewYearDto(cycle.State, cycle.StartDate, cycle.EndDate, today, phases, current, ordered, next, daysLeft, cycle.ClosedAt);
    }

    // ── Administration ───────────────────────────────────────────────────────────────────────────────────────────

    private async Task<NextCycleRowDto?> NextCycleAsync(PerformanceCycle selected, CancellationToken cancellationToken)
    {
        var draft = await db.Cycles.AsNoTracking()
            .Where(c => c.State == CycleLifecycleState.Draft && c.Id != selected.Id)
            .OrderByDescending(c => c.StartDate).FirstOrDefaultAsync(cancellationToken);
        if (draft is null) return null;
        return new NextCycleRowDto(draft.Id, draft.Name, draft.StartDate, await CycleDetailComposer.ComposeAsync(db, draft, cancellationToken));
    }

    private sealed record PopulationFacts(Guid EmployeeId, string Name, Guid? UnitId, string UnitName);
    private sealed record PlanFacts(Guid Id, Guid EmployeeId, PlanLifecycleState State);
    private sealed record ObjectiveFacts(Guid Id, Guid PlanId, ObjectiveStatus? Status, DateTime? LastProgressAt, DateTime? StatusReportedAt)
    {
        public DateTime? LastCheckInAt => StatusReportedAt is { } reported && (LastProgressAt is null || reported > LastProgressAt) ? reported : LastProgressAt;
    }

    private async Task<CycleRowDto> CycleRowAsync(PerformanceCycle cycle, ReviewRound? active, PlanActorContext actor, DateOnly today,
        CancellationToken cancellationToken)
    {
        var population = await db.Participants.AsNoTracking().Where(p => p.CycleId == cycle.Id)
            .Select(p => new PopulationFacts(p.EmployeeId, p.DisplayName, p.OrgUnitId, p.OrgUnitName ?? "No unit"))
            .ToListAsync(cancellationToken);
        var plans = await db.EmployeePlans.AsNoTracking().Where(p => p.CycleId == cycle.Id)
            .Select(p => new PlanFacts(p.Id, p.EmployeeId, p.State)).ToListAsync(cancellationToken);
        var approved = plans.Where(p => p.State == PlanLifecycleState.Approved).ToList();

        if (cycle.State == CycleLifecycleState.Draft)
            return new CycleRowDto(cycle.Id, cycle.Name, cycle.State, population.Count, approved.Count,
                await CycleDetailComposer.ComposeAsync(db, cycle, cancellationToken), null, null, null, null);

        var planByEmployee = plans.GroupBy(p => p.EmployeeId).ToDictionary(g => g.Key, g => g.First());
        var units = population.GroupBy(p => (p.UnitId, p.UnitName)).ToList();

        CyclePlanningFactsDto? planning = null;
        CycleExecutionFactsDto? execution = null;
        CycleReviewFactsDto? review = null;
        CycleClosedFactsDto? closed = null;

        if (cycle.State == CycleLifecycleState.Active && today <= cycle.PlanningDeadline)
        {
            var states = new PlanStatesDto(
                approved.Count,
                plans.Count(p => p.State == PlanLifecycleState.Submitted),
                plans.Count(p => p.State == PlanLifecycleState.Draft),
                population.Count(p => !planByEmployee.ContainsKey(p.EmployeeId)));
            var behind = units
                .Select(u => new UnitShareDto(u.Key.UnitId, u.Key.UnitName,
                    u.Count(p => planByEmployee.GetValueOrDefault(p.EmployeeId)?.State == PlanLifecycleState.Approved), u.Count(),
                    u.Count(p => !planByEmployee.ContainsKey(p.EmployeeId))))
                .Where(u => u.Count < u.Total)
                .OrderBy(u => (double)u.Count / u.Total).ThenByDescending(u => u.Total).ThenBy(u => u.Name)
                .Take(3).ToList();
            planning = new CyclePlanningFactsDto(states, behind);
        }
        else if (cycle.State == CycleLifecycleState.Active)
        {
            var approvedIds = approved.Select(p => p.Id).ToList();
            var objectives = await ObjectivesAsync(approvedIds, cancellationToken);
            var recent = PerformanceClock.UtcNow.AddDays(-RecentDays);
            var updatedPlans = objectives.Where(o => o.LastCheckInAt >= recent).Select(o => o.PlanId).ToHashSet();
            var approvedByEmployee = approved.ToDictionary(p => p.EmployeeId, p => p.Id);
            var behind = units
                .Select(u =>
                {
                    var withPlan = u.Where(p => approvedByEmployee.ContainsKey(p.EmployeeId)).ToList();
                    var updated = withPlan.Count(p => updatedPlans.Contains(approvedByEmployee[p.EmployeeId]));
                    return new UnitShareDto(u.Key.UnitId, u.Key.UnitName, updated, withPlan.Count, withPlan.Count - updated);
                })
                .Where(u => u.Total > 0 && u.Count < u.Total)
                .OrderBy(u => (double)u.Count / u.Total).ThenByDescending(u => u.Total).ThenBy(u => u.Name)
                .Take(3).ToList();
            execution = new CycleExecutionFactsDto(approved.Count, updatedPlans.Count, objectives.Count, Mix(objectives),
                population.Count(p => !approvedByEmployee.ContainsKey(p.EmployeeId)), behind);
        }

        if (active is not null)
            review = await RoundFactsAsync(active, population, actor, today, cancellationToken);

        if (cycle.State == CycleLifecycleState.Closed)
        {
            var released = await ReviewPolicy.Readable(db.PerformanceReviews.AsNoTracking(), new ReviewActor(actor.CallerEmployeeId, true))
                .Where(r => r.CycleId == cycle.Id && r.State == PerformanceReviewState.Finalized)
                .Select(r => new { r.AcknowledgedAt, r.CalibrationChangedRating, r.FinalizedAt })
                .ToListAsync(cancellationToken);
            var openGoals = await (from goal in db.DevelopmentGoals.AsNoTracking()
                                   join plan in db.DevelopmentPlans.AsNoTracking() on goal.DevelopmentPlanId equals plan.Id
                                   where plan.CycleId == cycle.Id && goal.Status != DevelopmentGoalStatus.Done
                                   select goal.Id).CountAsync(cancellationToken);
            closed = new CycleClosedFactsDto(released.Count, released.Count(r => r.AcknowledgedAt is not null),
                released.Count(r => r.CalibrationChangedRating), openGoals, released.Max(r => r.FinalizedAt));
        }

        return new CycleRowDto(cycle.Id, cycle.Name, cycle.State, population.Count, approved.Count, null, planning, execution, review, closed);
    }

    private async Task<CycleReviewFactsDto> RoundFactsAsync(ReviewRound round, IReadOnlyList<PopulationFacts> population,
        PlanActorContext actor, DateOnly today, CancellationToken cancellationToken)
    {
        var reviews = await ReviewPolicy.Readable(db.PerformanceReviews.AsNoTracking(), new ReviewActor(actor.CallerEmployeeId, true))
            .Where(r => r.ReviewRoundId == round.Id && r.State != PerformanceReviewState.Closed)
            .Select(r => new
            {
                r.State, r.SelfAssessmentEnabled, r.ReviewerEmployeeId, r.ReviewerDisplayName,
                Self = r.SelfAssessment.SubmittedAt != null, Manager = r.ManagerAssessment.SubmittedAt != null,
                Due = r.ManagerAssessmentDueDate ?? round.ManagerAssessmentDueDate,
            })
            .ToListAsync(cancellationToken);
        var late = reviews.Where(r => !r.Manager && r.Due is DateOnly due && due < today).ToList();
        var unitOf = population.ToDictionary(p => p.EmployeeId, p => p.UnitName);
        var byManager = reviews.GroupBy(r => (r.ReviewerEmployeeId, r.ReviewerDisplayName))
            .Select(g => new LateManagerDto(g.Key.ReviewerEmployeeId, g.Key.ReviewerDisplayName, unitOf.GetValueOrDefault(g.Key.ReviewerEmployeeId),
                g.Count(r => !r.Manager && r.Due is DateOnly due && due < today), g.Count(r => r.Manager), g.Count()))
            .Where(m => m.Late > 0)
            .OrderByDescending(m => m.Late).ThenBy(m => m.Name)
            .ToList();

        var session = round.CalibrationEnabled
            ? await db.CalibrationSessions.AsNoTracking().FirstOrDefaultAsync(s => s.ReviewRoundId == round.Id, cancellationToken)
            : null;
        int discussed = 0, subjects = 0;
        if (session is not null)
        {
            var calibrationSubjects = db.CalibrationSubjects.AsNoTracking().Where(s => s.SessionId == session.Id);
            subjects = await calibrationSubjects.CountAsync(cancellationToken);
            discussed = await calibrationSubjects.CountAsync(s => s.DiscussionState == CalibrationDiscussionState.Discussed, cancellationToken);
        }

        return new CycleReviewFactsDto(round.Id, round.Name, reviews.Count,
            reviews.Count(r => r.SelfAssessmentEnabled && r.Self), reviews.Count(r => r.SelfAssessmentEnabled), round.SelfAssessmentDueDate,
            reviews.Count(r => r.Manager), reviews.Count, late.Count, round.ManagerAssessmentDueDate,
            round.CalibrationEnabled, session?.State, discussed, subjects,
            reviews.Count(r => r.State == PerformanceReviewState.ReadyToFinalize),
            byManager.Take(2).ToList(), Math.Max(0, byManager.Count - 2), byManager.Skip(2).Sum(m => m.Late));
    }

    private async Task<List<ObjectiveFacts>> ObjectivesAsync(IReadOnlyCollection<Guid> planIds, CancellationToken cancellationToken)
        => planIds.Count == 0 ? [] : await db.Objectives.AsNoTracking()
            .Where(o => o.EmployeePlanId != null && planIds.Contains(o.EmployeePlanId.Value) && o.State != ObjectiveLifecycleState.Archived)
            .Select(o => new ObjectiveFacts(o.Id, o.EmployeePlanId!.Value, o.CurrentStatus, o.LastProgressAt, o.StatusReportedAt))
            .ToListAsync(cancellationToken);

    private static StatusMixDto Mix(IEnumerable<ObjectiveFacts> objectives)
    {
        var list = objectives.ToList();
        return new StatusMixDto(list.Count(o => o.Status == ObjectiveStatus.OnTrack), list.Count(o => o.Status == ObjectiveStatus.AtRisk),
            list.Count(o => o.Status == ObjectiveStatus.OffTrack), list.Count(o => o.Status is null));
    }

    // ── Responsibility ───────────────────────────────────────────────────────────────────────────────────────────

    private async Task<TeamRowDto> TeamAsync(PerformanceCycle cycle, ReviewRound? active, PlanActorContext actor, CancellationToken cancellationToken)
    {
        var me = actor.CallerEmployeeId;
        // Recorded responsibility only, and never the viewer (performance-team-workspace).
        var members = (await YourPeople.LoadMembersAsync(db, workforce, cycle, actor, cancellationToken))
            .Where(m => m.EmployeeId != me).ToList();
        var ordered = YourPeople.Ordered(members).ToList();
        var approved = members.Where(m => m.Status == RosterPlanStatus.Approved && m.PlanId is not null).ToList();
        var approvedPlanIds = approved.Select(m => m.PlanId!.Value).ToList();
        var nameByPlan = approved.ToDictionary(m => m.PlanId!.Value, m => (m.EmployeeId, Name: m.EmployeeName ?? "Someone"));

        var flagged = approvedPlanIds.Count == 0 ? [] : await db.Objectives.AsNoTracking()
            .Include(o => o.Measurement)
            .Where(o => o.EmployeePlanId != null && approvedPlanIds.Contains(o.EmployeePlanId.Value) && o.State != ObjectiveLifecycleState.Archived
                && (o.CurrentStatus == ObjectiveStatus.AtRisk || o.CurrentStatus == ObjectiveStatus.OffTrack))
            .ToListAsync(cancellationToken);
        var flaggedIds = flagged.Select(o => o.Id).ToList();
        var reasons = flaggedIds.Count == 0 ? new Dictionary<Guid, string?>() : (await db.ProgressUpdates.AsNoTracking()
                .Where(u => flaggedIds.Contains(u.ObjectiveId) && u.Status != null)
                .Select(u => new { u.ObjectiveId, u.ContextNote, u.RecordedAt })
                .ToListAsync(cancellationToken))
            .GroupBy(u => u.ObjectiveId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(u => u.RecordedAt).First().ContextNote);
        var flaggedFacts = flagged
            .OrderBy(o => o.CurrentStatus == ObjectiveStatus.OffTrack ? 0 : 1).ThenBy(o => o.StatusSince)
            .Select(o => new FlaggedObjectiveDto(o.Id, nameByPlan[o.EmployeePlanId!.Value].EmployeeId, nameByPlan[o.EmployeePlanId!.Value].Name,
                o.Title, o.CurrentStatus!.Value, reasons.GetValueOrDefault(o.Id), o.StatusSince, Math.Min(100m, o.DerivedProgress),
                PerformanceNotificationTemplates.ObjectivePath(cycle.Id, o.Id)))
            .ToList();

        var objectives = await ObjectivesAsync(approvedPlanIds, cancellationToken);
        var recent = PerformanceClock.UtcNow.AddDays(-RecentDays);
        var updatedPlans = objectives.Where(o => o.LastCheckInAt >= recent).Select(o => o.PlanId).ToHashSet();
        var stale = approved.Where(m => !updatedPlans.Contains(m.PlanId!.Value)).Select(m => m.EmployeeName ?? "Someone").ToList();

        var awaiting = ordered.Where(m => m.CanReview && m.PlanId is not null).ToList();
        var first = awaiting.OrderBy(m => m.ActivityAt ?? DateTime.MaxValue).FirstOrDefault();
        var chips = ordered.Take(Chips).Select(m => new OverviewChipDto(m.EmployeeId, m.EmployeeName ?? "Someone", m.Status.ToString(),
            m.Status == RosterPlanStatus.Submitted ? m.ActivityAt : null, m.CanReview,
            m.PlanId is Guid planId && m.CanView ? PerformanceNotificationTemplates.PlanPath(cycle.Id, planId) : null)).ToList();

        return new TeamRowDto(
            members.Count,
            approved.Sum(m => m.ObjectiveProgress.Count),
            new PlanStatesDto(approved.Count, members.Count(m => m.Status == RosterPlanStatus.Submitted),
                members.Count(m => m.Status is RosterPlanStatus.Draft or RosterPlanStatus.ReturnedForChanges),
                members.Count(m => m.Status == RosterPlanStatus.NotStarted)),
            awaiting.Count,
            first?.EmployeeName,
            first is null ? null : PerformanceNotificationTemplates.PlanPath(cycle.Id, first.PlanId!.Value),
            chips,
            flaggedFacts.Take(ListedObjectives).ToList(),
            flaggedFacts.Count,
            approved.Count,
            approved.Count(m => updatedPlans.Contains(m.PlanId!.Value)),
            stale.Take(ListedObjectives).ToList(),
            stale.Count,
            members.Count(m => m.UpdateRequest?.State == UpdateRequestState.Open),
            cycle.EndDate,
            await TeamResultsAsync(cycle, me, cancellationToken));
    }

    /// <summary>Released results of the viewer's own recorded team in this cycle; nothing before release (D-R2).</summary>
    private async Task<TeamResultsFactsDto?> TeamResultsAsync(PerformanceCycle cycle, Guid me, CancellationToken cancellationToken)
    {
        var released = await db.PerformanceReviews.AsNoTracking()
            .Where(r => r.CycleId == cycle.Id && r.ReviewerEmployeeId == me && r.SubjectEmployeeId != me && r.State == PerformanceReviewState.Finalized)
            .Select(r => new { r.SubjectEmployeeId, r.SubjectDisplayName, r.AcknowledgedAt, r.CalibrationChangedRating })
            .ToListAsync(cancellationToken);
        if (released.Count == 0) return null;
        var subjects = released.Select(r => r.SubjectEmployeeId).ToList();
        var withOpenGoals = await (from goal in db.DevelopmentGoals.AsNoTracking()
                                   join plan in db.DevelopmentPlans.AsNoTracking() on goal.DevelopmentPlanId equals plan.Id
                                   where plan.CycleId == cycle.Id && subjects.Contains(plan.EmployeeId) && goal.Status != DevelopmentGoalStatus.Done
                                   select plan.EmployeeId).Distinct().CountAsync(cancellationToken);
        var notAcknowledged = released.Where(r => r.AcknowledgedAt is null).Select(r => r.SubjectDisplayName).OrderBy(n => n).ToList();
        return new TeamResultsFactsDto(released.Count, released.Count - notAcknowledged.Count, notAcknowledged.Take(ListedObjectives).ToList(),
            released.Count(r => r.CalibrationChangedRating), withOpenGoals);
    }

    private async Task<ReviewsYouWriteRowDto?> ReviewsYouWriteAsync(ReviewRound round, Guid me, PlanActorContext actor, CancellationToken cancellationToken)
    {
        var reviews = await ReviewPolicy.Readable(db.PerformanceReviews.AsNoTracking(),
                new ReviewActor(me, actor.IsAdmin, CanReviewReports: actor.CanReviewReports))
            .Where(r => r.ReviewRoundId == round.Id && r.ReviewerEmployeeId == me && r.SubjectEmployeeId != me && r.State != PerformanceReviewState.Closed)
            .Select(r => new
            {
                r.Id, r.SubjectEmployeeId, r.SubjectDisplayName, r.State, r.PeerInputEnabled, r.PeersNominatedAt, r.PeerListApprovedAt,
                Submitted = r.ManagerAssessment.SubmittedAt != null,
                Due = r.ManagerAssessmentDueDate ?? round.ManagerAssessmentDueDate,
                SelfDue = r.SelfAssessmentDueDate ?? round.SelfAssessmentDueDate,
            })
            .ToListAsync(cancellationToken);
        if (reviews.Count == 0) return null;

        var withState = reviews.Select(r =>
        {
            var peers = r.PeerInputEnabled && r.PeersNominatedAt != null && r.PeerListApprovedAt == null && !r.Submitted;
            var ready = r.State == PerformanceReviewState.ManagerAssessment && !r.Submitted;
            var state = r.Submitted ? "submitted"
                : ready ? (peers ? "readyPeers" : "ready")
                : peers ? "peersToApprove"
                : "selfAssessment";
            return new { Review = r, Peers = peers, Ready = ready, State = state };
        }).ToList();
        var order = withState
            .OrderBy(r => r.Ready ? 0 : r.Peers ? 1 : r.Review.Submitted ? 3 : 2)
            .ThenBy(r => r.Review.SubjectDisplayName)
            .ToList();
        var firstReady = order.FirstOrDefault(r => r.Ready);
        var peerLists = withState.Where(r => r.Peers).ToList();
        return new ReviewsYouWriteRowDto(
            round.Id, round.Name,
            reviews.Select(r => r.Due).Where(d => d is not null).Min(),
            reviews.Count,
            withState.Count(r => r.Ready),
            reviews.Count(r => r.Submitted),
            peerLists.Count,
            peerLists.Select(r => r.Review.SelfDue).Where(d => d is not null).Min(),
            firstReady?.Review.SubjectDisplayName,
            firstReady is null ? null : PerformanceNotificationTemplates.ReviewPath(firstReady.Review.Id),
            order.Take(Chips).Select(r => new OverviewChipDto(r.Review.SubjectEmployeeId, r.Review.SubjectDisplayName, r.State, null,
                r.Ready || r.Peers, PerformanceNotificationTemplates.ReviewPath(r.Review.Id))).ToList(),
            reviews.All(r => r.Submitted) && reviews.Any(r => r.State == PerformanceReviewState.Calibration));
    }

    // ── One's own ────────────────────────────────────────────────────────────────────────────────────────────────

    private async Task<OwnReviewRowDto?> OwnReviewAsync(PerformanceCycle cycle, Guid me, CancellationToken cancellationToken)
    {
        var readable = ReviewPolicy.Readable(db.PerformanceReviews.AsNoTracking(), new ReviewActor(me, false))
            .Where(r => r.CycleId == cycle.Id && r.SubjectEmployeeId == me);
        var open = await readable
            .Where(r => r.State != PerformanceReviewState.Finalized && r.State != PerformanceReviewState.Closed)
            .OrderByDescending(r => r.OpenedAt).FirstOrDefaultAsync(cancellationToken);
        var review = open ?? await readable.Where(r => r.State == PerformanceReviewState.Finalized)
            .OrderByDescending(r => r.FinalizedAt).FirstOrDefaultAsync(cancellationToken);
        if (review is null) return null;

        var round = await db.ReviewRounds.AsNoTracking().FirstAsync(r => r.Id == review.ReviewRoundId, cancellationToken);
        var peers = await db.PeerRequests.AsNoTracking().Where(p => p.ReviewId == review.Id)
            .Select(p => p.State).ToListAsync(cancellationToken);

        OwnResultDto? result = null;
        if (review.State == PerformanceReviewState.Finalized && review.FinalRating is int level && review.FinalizedAt is DateTime releasedAt)
        {
            var label = (JsonSerializer.Deserialize<RatingScaleLevel[]>(review.RatingScaleSnapshotJson) ?? [])
                .FirstOrDefault(l => l.Value == level)?.Label ?? $"Level {level}";
            result = new OwnResultDto(level, label, releasedAt, review.AcknowledgedAt);
        }

        var selfDue = review.SelfAssessmentDueDate ?? round.SelfAssessmentDueDate;
        var managerDue = review.ManagerAssessmentDueDate ?? round.ManagerAssessmentDueDate;
        var steps = result is null && review.State == PerformanceReviewState.SelfAssessment && review.SelfAssessmentEnabled
            ? WorkSteps.SelfAssessment(review.ReviewerDisplayName, selfDue, managerDue, review.CalibrationEnabled)
            : null;
        return new OwnReviewRowDto(review.Id, round.Name, review.State, review.ReviewerDisplayName,
            review.State == PerformanceReviewState.SelfAssessment ? selfDue : review.CurrentStageDueDate,
            steps, peers.Count(s => s == PeerRequestState.Answered), peers.Count(s => s != PeerRequestState.Closed),
            review.SelfAssessment.SubmittedAt is null ? review.SelfAssessment.SavedAt : null, review.SelfAssessment.SubmittedAt,
            result, PerformanceNotificationTemplates.ReviewPath(review.Id));
    }

    private async Task<InputOwedRowDto?> InputOwedAsync(PerformanceCycle cycle, Guid me, CancellationToken cancellationToken)
    {
        var requests = await (from request in db.PeerRequests.AsNoTracking()
                              join round in db.ReviewRounds.AsNoTracking() on request.ReviewRoundId equals round.Id
                              where request.CycleId == cycle.Id && request.PeerEmployeeId == me && request.State == PeerRequestState.Open
                                    && round.State == ReviewRoundState.Active
                              orderby request.DueDate
                              select new
                              {
                                  request.Id, request.SubjectDisplayName, request.DueDate,
                                  Questions = db.ReviewQuestionSnapshots.Count(q => q.ReviewRoundId == round.Id && q.Audience == ReviewQuestionAudience.Peer),
                              })
            .ToListAsync(cancellationToken);
        return requests.Count == 0 ? null : new InputOwedRowDto(requests.Take(ListedObjectives)
            .Select(r => new PeerAskDto(r.Id, r.SubjectDisplayName, r.Questions, r.DueDate, PerformanceNotificationTemplates.PeerRequestPath(r.Id)))
            .ToList());
    }

    private async Task<OwnPlanRowDto> OwnPlanAsync(PerformanceCycle cycle, Guid me, DateOnly today, CancellationToken cancellationToken)
    {
        var participant = await db.Participants.AsNoTracking()
            .FirstOrDefaultAsync(p => p.CycleId == cycle.Id && p.EmployeeId == me, cancellationToken);
        var plan = await db.EmployeePlans.AsNoTracking().Include(p => p.Decisions)
            .FirstOrDefaultAsync(p => p.CycleId == cycle.Id && p.EmployeeId == me, cancellationToken);
        var objectives = plan is null
            ? []
            : await db.Objectives.AsNoTracking().Include(o => o.Measurement)
                .Where(o => o.EmployeePlanId == plan.Id && o.State != ObjectiveLifecycleState.Archived)
                .ToListAsync(cancellationToken);
        var settings = await db.CycleSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        // Update requests addressed to the viewer lead the row: the work item's own place (record mode or the plan).
        var requests = await (from request in db.UpdateRequests.AsNoTracking()
                              where request.CycleId == cycle.Id && request.EmployeeId == me && request.State == UpdateRequestState.Open
                              join objective in db.Objectives.AsNoTracking() on request.ObjectiveId equals objective.Id into targets
                              from objective in targets.DefaultIfEmpty()
                              orderby request.RequestedAt
                              select new { request.PlanId, request.ObjectiveId, request.RequestedByName, Title = objective == null ? null : objective.Title })
            .ToListAsync(cancellationToken);
        var firstRequest = requests.FirstOrDefault();

        var standing = PlansComposer.Classify(plan, objectives, today);
        var returned = standing.Status == RosterPlanStatus.ReturnedForChanges ? plan!.Decisions.OrderBy(d => d.DecidedAt).Last() : null;
        var now = PerformanceClock.UtcNow;
        var executing = standing.Status == RosterPlanStatus.Approved;
        var stale = executing
            ? objectives.Where(o => o.DerivedProgress < 100m && ExecutionFacts.LacksRecentUpdate(o, plan!.ApprovedAt ?? now, now)).ToList()
            : [];
        var stalestDays = stale.Count == 0 ? (int?)null
            : stale.Max(o => (int)(now - (o.LastCheckInAt ?? plan!.ApprovedAt ?? now)).TotalDays);

        return new OwnPlanRowDto(
            standing.Status,
            objectives.Count,
            objectives.Count(o => o.ParentObjectiveId is not null),
            objectives.Sum(o => o.PlanWeight ?? 0m),
            settings?.SuggestedObjectiveCountMin,
            settings?.SuggestedObjectiveCountMax,
            plan?.ResponsibleManagerName ?? participant?.ManagerDisplayName,
            plan?.SubmittedAt,
            returned?.Feedback,
            // An administrative return is never attributed to the reviewer.
            returned is not null && returned.ActorEmployeeId == plan!.ResponsibleManagerId ? plan.ResponsibleManagerName : null,
            cycle.PlanningDeadline,
            today <= cycle.PlanningDeadline,
            executing ? ProgressCalc.PlanProgress(objectives) : null,
            executing
                ? new StatusMixDto(objectives.Count(o => o.CurrentStatus == ObjectiveStatus.OnTrack), objectives.Count(o => o.CurrentStatus == ObjectiveStatus.AtRisk),
                    objectives.Count(o => o.CurrentStatus == ObjectiveStatus.OffTrack), objectives.Count(o => o.CurrentStatus is null))
                : null,
            objectives.Select(o => o.LastCheckInAt).Where(d => d is not null).Max(),
            stale.Count,
            stalestDays,
            requests.Count,
            firstRequest?.RequestedByName,
            firstRequest?.Title,
            firstRequest is null ? null
                : firstRequest.ObjectiveId is Guid objectiveId
                    ? PerformanceNotificationTemplates.ObjectivePath(cycle.Id, objectiveId, record: true)
                    : PerformanceNotificationTemplates.PlanPath(cycle.Id, firstRequest.PlanId),
            $"/performance/plan?cycle={cycle.Id}");
    }

    private async Task<DevelopmentRowDto?> DevelopmentAsync(PerformanceCycle cycle, Guid me, CancellationToken cancellationToken)
    {
        var released = await db.PerformanceReviews.AsNoTracking()
            .AnyAsync(r => r.CycleId == cycle.Id && r.SubjectEmployeeId == me && r.State == PerformanceReviewState.Finalized, cancellationToken);
        if (!released) return null;
        var plan = await db.DevelopmentPlans.AsNoTracking().FirstOrDefaultAsync(p => p.CycleId == cycle.Id && p.EmployeeId == me, cancellationToken);
        if (plan is null) return null;
        var goals = await db.DevelopmentGoals.AsNoTracking().Where(g => g.DevelopmentPlanId == plan.Id).ToListAsync(cancellationToken);
        if (goals.Count == 0) return null;
        var employeePlanId = await db.EmployeePlans.AsNoTracking().Where(p => p.CycleId == cycle.Id && p.EmployeeId == me)
            .Select(p => (Guid?)p.Id).FirstOrDefaultAsync(cancellationToken);
        return new DevelopmentRowDto(goals.Count, goals.Count(g => g.Status != DevelopmentGoalStatus.Done),
            goals.OrderBy(g => g.Status == DevelopmentGoalStatus.InProgress ? 0 : g.Status == DevelopmentGoalStatus.NotStarted ? 1 : 2)
                .ThenBy(g => g.TargetDate).Take(ListedObjectives)
                .Select(g => new DevelopmentGoalFactDto(g.Id, g.Title, g.Status, g.TargetDate)).ToList(),
            PerformanceNotificationTemplates.DevelopmentPath(cycle.Id, employeePlanId, me, forOwner: true));
    }

    /// <summary>
    /// The next 1:1s (at most two; a series' next meeting stays next until it's completed, even once its day has passed) and
    /// one owed thing: a feedback request first, else an overdue action. No cycle needed.
    /// </summary>
    private async Task<ConversationsRowDto?> ConversationsAsync(Guid me, CancellationToken cancellationToken)
    {
        if (me == Guid.Empty) return null;
        var now = PerformanceClock.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var meetings = await (from meeting in db.OneOnOneMeetings.AsNoTracking()
                              join series in db.OneOnOneSeries.AsNoTracking() on meeting.SeriesId equals series.Id
                              where (series.ManagerEmployeeId == me || series.ReportEmployeeId == me) && series.EndedAt == null
                                    && meeting.State == OneOnOneMeetingState.Upcoming
                              orderby meeting.ScheduledAt
                              select new
                              {
                                  SeriesId = series.Id, meeting.ScheduledAt,
                                  With = series.ManagerEmployeeId == me ? series.ReportName : series.ManagerName,
                                  Agenda = db.OneOnOneAgendaItems.Count(i => i.MeetingId == meeting.Id && i.DiscussedAt == null),
                                  Actions = db.OneOnOneActionItems.Count(a => a.SeriesId == series.Id && a.DoneAt == null),
                              })
            .Take(2).ToListAsync(cancellationToken);

        OwedConversationDto? owed = null;
        var requests = await db.FeedbackRequests.AsNoTracking()
            .Where(r => r.State == FeedbackRequestState.Open
                && r.Invitees.Any(i => i.EmployeeId == me && i.Status == FeedbackInviteeStatus.Waiting))
            .OrderBy(r => r.DueDate).Select(r => new { r.Id, r.RequesterName, r.Question, r.DueDate })
            .ToListAsync(cancellationToken);
        if (requests.Count > 0)
            owed = new("feedback-request", requests[0].RequesterName, requests[0].Question, requests[0].DueDate, requests.Count,
                PerformanceNotificationTemplates.FeedbackRequestPath(requests[0].Id));
        else
        {
            var overdue = await (from action in db.OneOnOneActionItems.AsNoTracking()
                                 join series in db.OneOnOneSeries.AsNoTracking() on action.SeriesId equals series.Id
                                 where action.OwnerEmployeeId == me && action.DoneAt == null && action.DueDate != null && action.DueDate < today
                                       && series.EndedAt == null
                                 orderby action.DueDate
                                 select new { action.Text, action.DueDate, SeriesId = series.Id,
                                     With = series.ManagerEmployeeId == me ? series.ReportName : series.ManagerName })
                .ToListAsync(cancellationToken);
            if (overdue.Count > 0)
                owed = new("overdue-action", overdue[0].Text, $"1:1 with {overdue[0].With}", overdue[0].DueDate, overdue.Count,
                    PerformanceNotificationTemplates.OneOnOnePath(overdue[0].SeriesId));
        }

        if (meetings.Count == 0 && owed is null) return null;
        return new ConversationsRowDto(meetings.Select(m => new NextMeetingDto(m.SeriesId, m.With,
                DateTime.SpecifyKind(m.ScheduledAt, DateTimeKind.Utc), m.Agenda, m.Actions, PerformanceNotificationTemplates.OneOnOnePath(m.SeriesId)))
            .ToList(), owed);
    }

    private async Task<NotParticipantRowDto> NotParticipantAsync(PerformanceCycle cycle, Guid me, DateOnly today, CancellationToken cancellationToken)
    {
        DateOnly? joined = null;
        try
        {
            joined = (await workforce.ResolveAsync(today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc), [me], cancellationToken))
                .FirstOrDefault()?.EmploymentStart;
        }
        catch (HttpRequestException)
        {
            // Core HR down: the row still says the person isn't part of the cycle, without the joining date.
        }
        return new NotParticipantRowDto(cycle.Name, joined, cycle.ActivatedAt);
    }

    private async Task<DirectionRowDto?> DirectionAsync(PerformanceCycle cycle, PlanActorContext actor, CancellationToken cancellationToken)
    {
        // Published direction is readable by every entrant, and the alignment map is theirs to open (D-06).
        var graph = await GoalsComposer.LoadGraphAsync(db, workforce, cycle, cancellationToken, new CycleViewer(actor.ToGoalActor(), null));
        var roots = graph.All
            .Where(o => o.OwnershipScope == ObjectiveOwnershipScope.Company && o.State == ObjectiveLifecycleState.Published)
            .OrderBy(o => o.Title)
            .ToList();
        return roots.Count == 0 ? null : new DirectionRowDto(roots.Count,
            roots.Take(ListedObjectives).Select(o => GoalsComposer.ToNode(o, graph)).ToList(),
            cycle.State == CycleLifecycleState.Closed);
    }
}
