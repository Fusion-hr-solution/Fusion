using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Features.Cycles;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Features.Plans;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Features.Workspace;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Overview;

public sealed record GetOverviewQuery(Guid? CycleId, WorkspaceGrants Grants, PlanActorContext Actor) : IQuery<Result<OverviewDto>>;

/// <summary>
/// Overview as one authorized projection. The selected Cycle, capabilities and destinations come from the
/// workspace context; each section is added only when its capability or recorded responsibility holds, so
/// a participant, a reviewer and an administrator — or one person who is all three — simply get the union.
/// Team counts cover only recorded responsibility; operational counts are administration's tenant view.
/// </summary>
public sealed class GetOverviewHandler(PerformanceDbContext db, PerformanceViewer viewer, ICoreWorkforceClient workforce)
    : IQueryHandler<GetOverviewQuery, Result<OverviewDto>>
{
    private const int ListedObjectives = 3;

    public async Task<Result<OverviewDto>> Handle(GetOverviewQuery request, CancellationToken cancellationToken)
    {
        var context = await new GetWorkspaceContextHandler(db, viewer)
            .Handle(new GetWorkspaceContextQuery(request.CycleId, request.Grants), cancellationToken);
        if (context.IsFailure) return Result.Failure<OverviewDto>(context.Error);
        var ctx = context.Value;
        var caps = ctx.Capabilities;

        if (ctx.Selected is null)
        {
            NoCycleSectionDto none = new(caps.Administers ? new OverviewDestinationDto(OverviewWorkspace.CycleCreate, null) : null);
            var noCycleSections = new List<OverviewSectionDto> { none };
            if (request.Actor.CallerEmployeeId is Guid employeeId && await MyReviewAsync(null, employeeId, cancellationToken) is { } myReview)
                noCycleSections.Add(myReview);
            return new OverviewDto(null, null, noCycleSections, ctx.Destinations);
        }

        var cycle = await db.Cycles.AsNoTracking().FirstAsync(c => c.Id == ctx.Selected.Id, cancellationToken);
        var sections = cycle.State switch
        {
            CycleLifecycleState.Draft => [await SetupAsync(cycle, cancellationToken)],
            CycleLifecycleState.Closed => [await ClosedAsync(cycle, caps, request.Actor, cancellationToken)],
            _ => await ActiveAsync(cycle, ctx, request.Actor, cancellationToken),
        };
        return new OverviewDto(ctx.Selected, ctx.Phase, sections, ctx.Destinations);
    }

    private async Task<List<OverviewSectionDto>> ActiveAsync(
        PerformanceCycle cycle, WorkspaceContextDto ctx, PlanActorContext actor, CancellationToken cancellationToken)
    {
        var caps = ctx.Capabilities;
        var sections = new List<OverviewSectionDto>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        GoalsComposer.Graph? graph = null;
        async Task<GoalsComposer.Graph> Graph() => graph ??= await GoalsComposer.LoadGraphAsync(
            db, workforce, cycle, cancellationToken, new CycleViewer(actor.ToGoalActor(), null));

        // One's own work, the people one is responsible for, then the organization, then what comes next.
        if (caps.Participates && actor.CallerEmployeeId is Guid me)
        {
            sections.Add(await MyPlanAsync(cycle, me, today, cancellationToken));
            if (await MyReviewAsync(cycle.Id, me, cancellationToken) is { } myReview) sections.Add(myReview);
            if (await MyRequestsAsync(cycle.Id, me, cancellationToken) is { } myRequests) sections.Add(myRequests);
        }

        if (caps.IsResponsibleReviewer)
        {
            var members = await YourPeople.LoadMembersAsync(db, workforce, cycle, actor, cancellationToken);
            int Count(RosterPlanStatus status) => members.Count(m => m.Status == status);
            var awaiting = members.Count(m => m.CanReview);
            sections.Add(new TeamPlanningSectionDto(
                members.Count, awaiting, Count(RosterPlanStatus.NotStarted), Count(RosterPlanStatus.Draft),
                Count(RosterPlanStatus.ReturnedForChanges), Count(RosterPlanStatus.Submitted), Count(RosterPlanStatus.Approved),
                new OverviewDestinationDto(awaiting > 0 ? OverviewWorkspace.TeamNeedsReview : OverviewWorkspace.Team, cycle.Id)));

            var approved = members.Where(m => m.Status == RosterPlanStatus.Approved).ToList();
            if (approved.Count > 0)
                sections.Add(new TeamExecutionSectionDto(
                    approved.Count,
                    approved.Count(m => m.HasProgress),
                    approved.Count(m => m.OverdueObjectiveCount > 0),
                    approved.Count(m => m.ObjectivesWithoutRecentUpdate > 0),
                    new OverviewDestinationDto(OverviewWorkspace.Team, cycle.Id)));

            if ((caps.ManagesOrgObjectives || caps.Administers) && actor.CallerEmployeeId is Guid lead)
            {
                var g = await Graph();
                var owned = g.All
                    .Where(o => o.OwnershipScope == ObjectiveOwnershipScope.OrgUnit && o.AccountablePersonId == lead
                        && o.State != ObjectiveLifecycleState.Archived)
                    .OrderBy(o => o.State == ObjectiveLifecycleState.Published ? 0 : 1).ThenBy(o => o.Title)
                    .ToList();
                sections.Add(new TeamDirectionSectionDto(
                    owned.FirstOrDefault()?.OrgUnitName, owned.Count,
                    owned.Take(ListedObjectives).Select(o => GoalsComposer.ToNode(o, g)).ToList(),
                    new OverviewDestinationDto(OverviewWorkspace.Team, cycle.Id)));
            }
        }

        if (caps.HasReviewWork && actor.CallerEmployeeId != Guid.Empty)
        {
            var reviewerId = actor.CallerEmployeeId;
            var assigned = await ReviewPolicy.Readable(db.PerformanceReviews.AsNoTracking(),
                    new ReviewActor(reviewerId, caps.Administers, CanReviewReports: actor.CanReviewReports))
                .Where(review => review.CycleId == cycle.Id && review.ReviewerEmployeeId == reviewerId && review.State != PerformanceReviewState.Closed)
                .Select(review => new { review.State, Submitted = review.ManagerAssessment.SubmittedAt != null })
                .ToListAsync(cancellationToken);
            var readyAssessments = assigned.Count(review => review.State == PerformanceReviewState.ManagerAssessment);
            if (readyAssessments > 0)
                sections.Add(new TeamReviewsSectionDto(readyAssessments, new OverviewDestinationDto(OverviewWorkspace.Reviews, cycle.Id),
                    assigned.Count(review => review.Submitted), assigned.Count));
        }

        if (await CalibrationAsync(cycle, caps, viewer.UserId ?? Guid.Empty, cancellationToken) is { } calibration)
            sections.Add(calibration);

        if (caps.Administers)
        {
            var summary = await new GetCyclePlanSummaryHandler(db).Handle(new GetCyclePlanSummaryQuery(cycle.Id), cancellationToken);
            var detail = await CycleDetailComposer.ComposeAsync(db, cycle, cancellationToken);
            sections.Add(new CycleOperationSectionDto(summary.Value, detail.Milestones,
                new OverviewDestinationDto(OverviewWorkspace.CycleAdmin, cycle.Id)));
            var activeRound = await db.ReviewRounds.AsNoTracking().Where(round => round.CycleId == cycle.Id && round.State == ReviewRoundState.Active)
                .OrderByDescending(round => round.LaunchedAt).FirstOrDefaultAsync(cancellationToken);
            if (activeRound is not null)
            {
                var reviewRecords = ReviewPolicy.Readable(db.PerformanceReviews.AsNoTracking(),
                    new ReviewActor(actor.CallerEmployeeId, caps.Administers));
                var stageCounts = await reviewRecords.Where(review => review.ReviewRoundId == activeRound.Id)
                    .GroupBy(review => review.State).Select(group => new ReviewStageCountOverviewDto(group.Key, group.Count())).ToListAsync(cancellationToken);
                var completion = await reviewRecords
                    .Where(review => review.ReviewRoundId == activeRound.Id && review.State != PerformanceReviewState.Closed)
                    .Select(review => new { review.SelfAssessmentEnabled, Self = review.SelfAssessment.SubmittedAt != null, Manager = review.ManagerAssessment.SubmittedAt != null })
                    .ToListAsync(cancellationToken);
                sections.Add(new ReviewOperationSectionDto(activeRound.Id, activeRound.Name, activeRound.State, stageCounts,
                    stageCounts.FirstOrDefault(item => item.State == PerformanceReviewState.ReadyToFinalize)?.Count ?? 0,
                    new OverviewDestinationDto(OverviewWorkspace.ReviewRound, cycle.Id, ReviewRoundId: activeRound.Id),
                    new Features.Reviews.ReviewCompletionDto(completion.Count(r => r.SelfAssessmentEnabled && r.Self), completion.Count(r => r.SelfAssessmentEnabled)),
                    new Features.Reviews.ReviewCompletionDto(completion.Count(r => r.Manager), completion.Count)));
            }
        }

        if (caps.CanViewOrgDirection)
        {
            var g = await Graph();
            var roots = g.All
                .Where(o => o.OwnershipScope == ObjectiveOwnershipScope.Company && o.State == ObjectiveLifecycleState.Published)
                .OrderBy(o => o.Title)
                .ToList();
            sections.Add(new DirectionSectionDto(roots.Count,
                roots.Take(ListedObjectives).Select(o => GoalsComposer.ToNode(o, g)).ToList(),
                new OverviewDestinationDto(OverviewWorkspace.OrganizationDirection, cycle.Id)));
        }

        // The next Cycle being prepared alongside the running one.
        if (caps.Administers)
        {
            var draft = await db.Cycles.AsNoTracking()
                .Where(c => c.State == CycleLifecycleState.Draft)
                .OrderByDescending(c => c.StartDate)
                .FirstOrDefaultAsync(cancellationToken);
            if (draft is not null) sections.Add(await SetupAsync(draft, cancellationToken));
        }

        if (sections.Count == 0) sections.Add(new CycleStatusSectionDto(ctx.Selected!, ctx.Phase));
        return sections;
    }

    private async Task<MyRequestsSectionDto?> MyRequestsAsync(Guid cycleId, Guid employeeId, CancellationToken cancellationToken)
    {
        var open = await (from request in db.UpdateRequests.AsNoTracking()
                          where request.CycleId == cycleId && request.EmployeeId == employeeId && request.State == UpdateRequestState.Open
                          join objective in db.Objectives.AsNoTracking() on request.ObjectiveId equals objective.Id into targets
                          from objective in targets.DefaultIfEmpty()
                          orderby request.RequestedAt
                          select new { request, Title = objective == null ? null : objective.Title })
            .ToListAsync(cancellationToken);
        if (open.Count == 0) return null;
        return new MyRequestsSectionDto(open.Select(item => new MyUpdateRequestDto(item.request.Id, item.request.RequestedByName,
            item.request.RequestedAt, item.request.Note, item.Title,
            item.request.ObjectiveId is Guid objectiveId
                ? new OverviewDestinationDto(OverviewWorkspace.Objective, cycleId, item.request.PlanId, objectiveId)
                : new OverviewDestinationDto(OverviewWorkspace.Plan, cycleId, item.request.PlanId))).ToArray());
    }

    private async Task<MyReviewSectionDto?> MyReviewAsync(Guid? cycleId, Guid employeeId, CancellationToken cancellationToken)
    {
        var readable = ReviewPolicy.Readable(db.PerformanceReviews.AsNoTracking(), new ReviewActor(employeeId, false));
        var openQuery = readable.Where(review => review.SubjectEmployeeId == employeeId
            && review.State != PerformanceReviewState.Finalized && review.State != PerformanceReviewState.Closed);
        if (cycleId is Guid selectedCycle) openQuery = openQuery.Where(review => review.CycleId == selectedCycle);
        var open = await openQuery.OrderByDescending(review => review.OpenedAt)
            .Select(review => new { review.Id, review.State, review.CurrentStageDueDate }).FirstOrDefaultAsync(cancellationToken);
        var historyQuery = readable.Where(review => review.SubjectEmployeeId == employeeId
            && review.State == PerformanceReviewState.Finalized);
        if (cycleId is Guid historyCycle) historyQuery = historyQuery.Where(review => review.CycleId == historyCycle);
        var finalizedCount = await historyQuery.CountAsync(cancellationToken);
        var resultId = await historyQuery.OrderByDescending(review => review.FinalizedAt).Select(review => (Guid?)review.Id).FirstOrDefaultAsync(cancellationToken);
        if (open is null && resultId is null) return null;
        return new(open?.Id, open?.State, open?.CurrentStageDueDate, resultId, finalizedCount,
            new OverviewDestinationDto(OverviewWorkspace.Reviews, cycleId));
    }

    private async Task<OverviewSectionDto> MyPlanAsync(PerformanceCycle cycle, Guid employeeId, DateOnly today, CancellationToken cancellationToken)
    {
        var participant = await db.Participants.AsNoTracking()
            .FirstOrDefaultAsync(p => p.CycleId == cycle.Id && p.EmployeeId == employeeId, cancellationToken);
        var plan = await db.EmployeePlans.AsNoTracking().Include(p => p.Decisions)
            .FirstOrDefaultAsync(p => p.CycleId == cycle.Id && p.EmployeeId == employeeId, cancellationToken);
        var objectives = plan is null
            ? []
            : await db.Objectives.AsNoTracking().Include(o => o.Measurement)
                .Where(o => o.EmployeePlanId == plan.Id && o.State != ObjectiveLifecycleState.Archived)
                .ToListAsync(cancellationToken);

        var standing = PlansComposer.Classify(plan, objectives, today);
        var reviewer = plan?.ResponsibleManagerName ?? participant?.ManagerDisplayName;
        var returned = standing.Status == RosterPlanStatus.ReturnedForChanges
            ? plan!.Decisions.OrderBy(d => d.DecidedAt).Last()
            : null;

        PlanExecutionFactsDto? execution = null;
        if (standing.Status == RosterPlanStatus.Approved)
        {
            var now = DateTime.UtcNow;
            var started = plan!.ApprovedAt ?? now;
            execution = new PlanExecutionFactsDto(
                ProgressCalc.PlanProgress(objectives),
                objectives.Count,
                objectives.Count(o => o.HasProgress),
                standing.OverdueObjectiveCount,
                objectives.Count(o => o.DerivedProgress < 100m && ExecutionFacts.LacksRecentUpdate(o, started, now)));
        }

        return new MyPlanSectionDto(
            standing.Status,
            objectives.Count,
            objectives.Sum(o => o.PlanWeight ?? 0m),
            reviewer,
            plan?.SubmittedAt,
            returned?.Feedback,
            // An administrative return is never attributed to the reviewer.
            returned is not null && returned.ActorEmployeeId == plan!.ResponsibleManagerId ? plan.ResponsibleManagerName : null,
            cycle.PlanningDeadline,
            today <= cycle.PlanningDeadline,
            execution,
            new OverviewDestinationDto(OverviewWorkspace.MyPlan, cycle.Id));
    }

    private async Task<OverviewSectionDto> SetupAsync(PerformanceCycle cycle, CancellationToken cancellationToken)
        => new SetupReadinessSectionDto(
            await CycleDetailComposer.ComposeAsync(db, cycle, cancellationToken),
            new OverviewDestinationDto(OverviewWorkspace.CycleSetup, cycle.Id));

    private async Task<OverviewSectionDto> ClosedAsync(
        PerformanceCycle cycle, WorkspaceCapabilitiesDto caps, PlanActorContext actor, CancellationToken cancellationToken)
    {
        var snapshot = await db.Set<ActivationSnapshot>().AsNoTracking().FirstOrDefaultAsync(s => s.CycleId == cycle.Id, cancellationToken);
        var participantCount = snapshot?.ConfirmedParticipantCount
            ?? await db.Participants.AsNoTracking().CountAsync(p => p.CycleId == cycle.Id, cancellationToken);
        var approvedCount = await db.EmployeePlans.AsNoTracking()
            .CountAsync(p => p.CycleId == cycle.Id && p.State == PlanLifecycleState.Approved, cancellationToken);
        var exceptionCount = await db.Participants.AsNoTracking()
            .CountAsync(p => p.CycleId == cycle.Id && p.ClosureExceptionReason != null, cancellationToken);
        var finalizedReviewCount = caps.Administers
            ? await ReviewPolicy.Readable(db.PerformanceReviews.AsNoTracking(), new ReviewActor(actor.CallerEmployeeId, true))
                .CountAsync(review => review.CycleId == cycle.Id && review.State == PerformanceReviewState.Finalized, cancellationToken)
            : actor.CallerEmployeeId is Guid employeeId
                ? await ReviewPolicy.Readable(db.PerformanceReviews.AsNoTracking(),
                        new ReviewActor(employeeId, false, CanReviewReports: actor.CanReviewReports))
                    .CountAsync(review => review.CycleId == cycle.Id && review.State == PerformanceReviewState.Finalized, cancellationToken)
                : 0;

        decimal? myProgress = null;
        if (caps.Participates && actor.CallerEmployeeId is Guid me)
        {
            var plan = await db.EmployeePlans.AsNoTracking()
                .FirstOrDefaultAsync(p => p.CycleId == cycle.Id && p.EmployeeId == me && p.State == PlanLifecycleState.Approved, cancellationToken);
            if (plan is not null)
                myProgress = ProgressCalc.PlanProgress(await db.Objectives.AsNoTracking().Include(o => o.Measurement)
                    .Where(o => o.EmployeePlanId == plan.Id && o.State != ObjectiveLifecycleState.Archived)
                    .ToListAsync(cancellationToken));
        }

        OverviewDestinationDto? next = null;
        if (caps.Administers)
        {
            var draft = await db.Cycles.AsNoTracking()
                .Where(c => c.State == CycleLifecycleState.Draft)
                .OrderByDescending(c => c.StartDate)
                .FirstOrDefaultAsync(cancellationToken);
            next = draft is null
                ? new OverviewDestinationDto(OverviewWorkspace.CycleCreate, null)
                : new OverviewDestinationDto(OverviewWorkspace.CycleSetup, draft.Id);
        }

        var view = new OverviewDestinationDto(
            caps.Administers ? OverviewWorkspace.CycleAdmin : caps.Participates ? OverviewWorkspace.MyPlan : OverviewWorkspace.Team,
            cycle.Id);
        return new ClosedCycleSectionDto(
            PerformanceMappers.ToSummary(cycle), participantCount, approvedCount, exceptionCount,
            FinalizedReviewCount: finalizedReviewCount, myProgress, view, next)
        {
            Reviews = finalizedReviewCount > 0 ? new OverviewDestinationDto(OverviewWorkspace.Reviews, cycle.Id) : null,
        };
    }

    private async Task<CalibrationSectionDto?> CalibrationAsync(
        PerformanceCycle cycle, WorkspaceCapabilitiesDto caps, Guid userId, CancellationToken cancellationToken)
    {
        if (!caps.CanCalibrate || userId == Guid.Empty) return null;
        var round = await db.ReviewRounds.AsNoTracking()
            .Where(item => item.CycleId == cycle.Id && item.CalibrationEnabled && item.State == ReviewRoundState.Active)
            .OrderByDescending(item => item.LaunchedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (round is null) return null;

        var session = await db.CalibrationSessions.AsNoTracking().Include(item => item.Facilitators)
            .FirstOrDefaultAsync(item => item.ReviewRoundId == round.Id, cancellationToken);
        if (session is not null && !session.IsFacilitator(userId)) return null;

        var outstanding = await db.PerformanceReviews.AsNoTracking()
            .CountAsync(review => review.ReviewRoundId == round.Id
                && (review.State == PerformanceReviewState.SelfAssessment || review.State == PerformanceReviewState.ManagerAssessment), cancellationToken);
        if (session is null)
        {
            var subjects = await db.PerformanceReviews.AsNoTracking()
                .CountAsync(review => review.ReviewRoundId == round.Id && review.State == PerformanceReviewState.Calibration, cancellationToken);
            return new CalibrationSectionDto(subjects, 0, subjects, outstanding, null,
                new OverviewDestinationDto(OverviewWorkspace.Calibration, cycle.Id, ReviewRoundId: round.Id));
        }

        var calibrationSubjects = db.CalibrationSubjects.AsNoTracking().Where(subject => subject.SessionId == session.Id);
        var total = await calibrationSubjects.CountAsync(cancellationToken);
        var discussed = await calibrationSubjects.CountAsync(subject => subject.DiscussionState == CalibrationDiscussionState.Discussed, cancellationToken);
        return new CalibrationSectionDto(total, discussed, total - discussed, outstanding, session.State,
            new OverviewDestinationDto(OverviewWorkspace.Calibration, cycle.Id, ReviewRoundId: round.Id));
    }
}
