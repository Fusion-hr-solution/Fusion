using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Features.Cycles;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Work;

/// <summary>What the caller may act on, from the token; responsibility itself is read from Performance state.</summary>
public sealed record WorkActor(Guid EmployeeId, Guid UserId, bool Participates, bool ReviewsReports, bool Administers, bool Calibrates);

public sealed record GetWorkItemsQuery(WorkActor Actor) : IQuery<Result<IReadOnlyList<FusionWorkItemDto>>>;

/// <summary>
/// The caller's Performance work, derived at request time from the active Cycle and the active review rounds
/// (P3: one list, never stored). Each rule mirrors the surface where the work is done: My Plan's planning
/// state, the plan decision authority, open update requests, the review work queue, calibration sessions
/// and round finalization. Items carry absolute app paths and stable ids.
/// </summary>
public sealed class GetWorkItemsHandler(PerformanceDbContext db)
    : IQueryHandler<GetWorkItemsQuery, Result<IReadOnlyList<FusionWorkItemDto>>>
{
    private const string Module = "performance";

    public async Task<Result<IReadOnlyList<FusionWorkItemDto>>> Handle(GetWorkItemsQuery query, CancellationToken token)
    {
        var actor = query.Actor;
        var items = new List<FusionWorkItemDto>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var cycle = await db.Cycles.AsNoTracking().Where(c => c.State == CycleLifecycleState.Active)
            .OrderByDescending(c => c.StartDate).FirstOrDefaultAsync(token);

        if (cycle is not null && actor.EmployeeId != Guid.Empty)
        {
            if (actor.Participates) await PlanningAsync(cycle, actor.EmployeeId, today, items, token);
            if (actor.ReviewsReports) await PlanDecisionsAsync(cycle, actor.EmployeeId, items, token);
            await UpdateRequestsAsync(cycle, actor.EmployeeId, items, token);
        }
        if (actor.EmployeeId != Guid.Empty) await AssessmentsAsync(actor, items, token);
        if (actor.Calibrates && actor.UserId != Guid.Empty) await CalibrationAsync(actor.UserId, items, token);
        if (actor.Administers) await FinalizationAsync(items, token);
        return Result.Success<IReadOnlyList<FusionWorkItemDto>>(items);
    }

    private static string Id(string kind, Guid resourceId) => $"{Module}:{kind}:{resourceId}";

    /// <summary>A participant in planning whose plan isn't submitted, or came back returned.</summary>
    private async Task PlanningAsync(PerformanceCycle cycle, Guid employeeId, DateOnly today, List<FusionWorkItemDto> items, CancellationToken token)
    {
        if (CycleDetailComposer.PhaseOf(cycle, today) != CyclePhase.Planning) return;
        var participant = await db.Participants.AsNoTracking()
            .FirstOrDefaultAsync(p => p.CycleId == cycle.Id && p.EmployeeId == employeeId, token);
        if (participant is null) return;
        var plan = await db.EmployeePlans.AsNoTracking().Include(p => p.Decisions)
            .FirstOrDefaultAsync(p => p.CycleId == cycle.Id && p.EmployeeId == employeeId, token);
        if (plan is not null && plan.State != PlanLifecycleState.Draft) return;
        var returned = plan?.Decisions.OrderBy(d => d.DecidedAt).LastOrDefault()?.Kind == PlanDecisionKind.Returned;
        items.Add(new(Id(returned ? "plan-revise" : "plan-write", plan?.Id ?? participant.Id), Module,
            returned ? "plan-revise" : "plan-write",
            returned ? "Revise your plan" : "Write your plan",
            returned ? "Your reviewer asked for changes" : cycle.Name,
            cycle.PlanningDeadline, "/performance/plan"));
    }

    /// <summary>Submitted plans waiting for the caller's decision as their responsible reviewer.</summary>
    private async Task PlanDecisionsAsync(PerformanceCycle cycle, Guid employeeId, List<FusionWorkItemDto> items, CancellationToken token)
    {
        var plans = await db.EmployeePlans.AsNoTracking()
            .Where(p => p.CycleId == cycle.Id && p.ResponsibleManagerId == employeeId && p.State == PlanLifecycleState.Submitted)
            .OrderByDescending(p => p.SubmittedAt)
            .Select(p => new { p.Id, p.EmployeeDisplayName })
            .ToListAsync(token);
        items.AddRange(plans.Select(p => new FusionWorkItemDto(Id("plan-decision", p.Id), Module, "plan-decision",
            $"Review {p.EmployeeDisplayName}'s plan", "Waiting for your decision", null,
            PerformanceNotificationTemplates.PlanPath(cycle.Id, p.Id), new FusionWorkSubjectDto(p.EmployeeDisplayName))));
    }

    /// <summary>Open update requests addressed to the caller: one objective opens in record mode, the plan opens the plan.</summary>
    private async Task UpdateRequestsAsync(PerformanceCycle cycle, Guid employeeId, List<FusionWorkItemDto> items, CancellationToken token)
    {
        var open = await (from request in db.UpdateRequests.AsNoTracking()
                          where request.CycleId == cycle.Id && request.EmployeeId == employeeId && request.State == UpdateRequestState.Open
                          join objective in db.Objectives.AsNoTracking() on request.ObjectiveId equals objective.Id into targets
                          from objective in targets.DefaultIfEmpty()
                          orderby request.RequestedAt descending
                          select new { request.Id, request.PlanId, request.ObjectiveId, request.RequestedByName, Title = objective == null ? null : objective.Title })
            .ToListAsync(token);
        items.AddRange(open.Select(r => new FusionWorkItemDto(Id("update-request", r.Id), Module, "update-request",
            r.ObjectiveId is null ? "Update progress on your plan" : $"Update progress on {r.Title}",
            $"{r.RequestedByName} asked for an update", null,
            r.ObjectiveId is Guid objectiveId
                ? PerformanceNotificationTemplates.ObjectivePath(cycle.Id, objectiveId, record: true)
                : PerformanceNotificationTemplates.PlanPath(cycle.Id, r.PlanId))));
    }

    /// <summary>The review work queue's own rule: the subject in self-assessment, the reviewer in manager assessment.</summary>
    private async Task AssessmentsAsync(WorkActor actor, List<FusionWorkItemDto> items, CancellationToken token)
    {
        var me = actor.EmployeeId;
        var reviewActor = new ReviewActor(me, false, CanParticipate: actor.Participates, CanReviewReports: actor.ReviewsReports);
        var due = await (from review in ReviewPolicy.Readable(db.PerformanceReviews.AsNoTracking(), reviewActor)
                         join round in db.ReviewRounds.AsNoTracking() on review.ReviewRoundId equals round.Id
                         where round.State == ReviewRoundState.Active
                            && ((review.State == PerformanceReviewState.SelfAssessment && review.SubjectEmployeeId == me
                                    && review.SelfAssessmentEnabled && review.SelfAssessment.SubmittedAt == null)
                                || (review.State == PerformanceReviewState.ManagerAssessment && review.ReviewerEmployeeId == me
                                    && review.ManagerAssessment.SubmittedAt == null))
                         orderby review.CurrentStageDueDate, review.SubjectDisplayName
                         select new { review.Id, review.State, review.SubjectDisplayName, review.CurrentStageDueDate, RoundName = round.Name })
            .ToListAsync(token);
        foreach (var review in due)
        {
            var self = review.State == PerformanceReviewState.SelfAssessment;
            if (self && !actor.Participates || !self && !actor.ReviewsReports) continue;
            items.Add(new(Id(self ? "self-assessment" : "manager-assessment", review.Id), Module,
                self ? "self-assessment" : "manager-assessment",
                self ? "Complete your self-assessment" : $"Assess {review.SubjectDisplayName}",
                review.RoundName, review.CurrentStageDueDate,
                PerformanceNotificationTemplates.ReviewPath(review.Id),
                self ? null : new FusionWorkSubjectDto(review.SubjectDisplayName)));
        }
    }

    /// <summary>Open calibration sessions the caller facilitates.</summary>
    private async Task CalibrationAsync(Guid userId, List<FusionWorkItemDto> items, CancellationToken token)
    {
        var sessions = await (from session in db.CalibrationSessions.AsNoTracking()
                              join round in db.ReviewRounds.AsNoTracking() on session.ReviewRoundId equals round.Id
                              where session.State == CalibrationSessionState.Open && round.State == ReviewRoundState.Active
                                 && session.Facilitators.Any(f => f.UserId == userId)
                              orderby session.OpenedAt descending
                              select new { session.Id, session.ReviewRoundId, RoundName = round.Name })
            .ToListAsync(token);
        items.AddRange(sessions.Select(s => new FusionWorkItemDto(Id("calibration", s.Id), Module, "calibration",
            $"Calibrate {s.RoundName}", "Calibration session open", null,
            PerformanceNotificationTemplates.CalibrationPath(s.ReviewRoundId))));
    }

    /// <summary>Active rounds whose remaining reviews are all ready to finalize.</summary>
    private async Task FinalizationAsync(List<FusionWorkItemDto> items, CancellationToken token)
    {
        var rounds = await db.ReviewRounds.AsNoTracking()
            .Where(round => round.State == ReviewRoundState.Active)
            .Select(round => new
            {
                round.Id,
                round.Name,
                Ready = db.PerformanceReviews.Count(r => r.ReviewRoundId == round.Id && r.State == PerformanceReviewState.ReadyToFinalize),
                Pending = db.PerformanceReviews.Count(r => r.ReviewRoundId == round.Id
                    && r.State != PerformanceReviewState.ReadyToFinalize && r.State != PerformanceReviewState.Finalized
                    && r.State != PerformanceReviewState.Closed),
            })
            .ToListAsync(token);
        items.AddRange(rounds.Where(r => r.Ready > 0 && r.Pending == 0).Select(r => new FusionWorkItemDto(
            Id("round-finalize", r.Id), Module, "round-finalize", $"Finalize {r.Name}",
            r.Ready == 1 ? "1 review is ready to finalize" : $"{r.Ready} reviews are ready to finalize", null,
            PerformanceNotificationTemplates.RoundPath(r.Id))));
    }
}
