using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Progress;
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
            if (actor.ReviewsReports)
            {
                await PlanDecisionsAsync(cycle, actor.EmployeeId, items, token);
                await ObjectiveAttentionAsync(cycle, actor.EmployeeId, items, token);
            }
            await UpdateRequestsAsync(cycle, actor.EmployeeId, items, token);
        }
        if (actor.EmployeeId != Guid.Empty)
        {
            await AssessmentsAsync(actor, today, items, token);
            await PeerWorkAsync(actor, today, items, token);
            await FeedbackRequestsAsync(actor.EmployeeId, items, token);
            await OneOnOneActionsAsync(actor.EmployeeId, today, items, token);
        }
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
        var open = plan?.OpenChangeRequests.Count ?? 0;
        items.Add(new(Id(returned ? "plan-revise" : "plan-write", plan?.Id ?? participant.Id), Module,
            returned ? "plan-revise" : "plan-write",
            returned ? "Revise your plan" : "Write your plan",
            !returned ? cycle.Name
                : open == 1 ? "1 change to address"
                : open > 1 ? $"{open} changes to address"
                : "Your reviewer asked for changes",
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

    /// <summary>
    /// Objectives of approved plans the caller is responsible for, reported At risk or Off track and not yet
    /// acknowledged (D-05). Each opens the objective, where the caller acknowledges it.
    /// </summary>
    private async Task ObjectiveAttentionAsync(PerformanceCycle cycle, Guid employeeId, List<FusionWorkItemDto> items, CancellationToken token)
    {
        var flagged = await (from objective in db.Objectives.AsNoTracking()
                             join plan in db.EmployeePlans.AsNoTracking() on objective.EmployeePlanId equals plan.Id
                             where plan.CycleId == cycle.Id && plan.ResponsibleManagerId == employeeId
                                && plan.State == PlanLifecycleState.Approved
                                && (objective.CurrentStatus == ObjectiveStatus.AtRisk || objective.CurrentStatus == ObjectiveStatus.OffTrack)
                                && objective.StatusAcknowledgedAt == null
                             orderby objective.StatusSince descending
                             select new { objective.Id, objective.Title, objective.CurrentStatus, plan.EmployeeDisplayName })
            .ToListAsync(token);
        items.AddRange(flagged.Select(o => new FusionWorkItemDto(Id("objective-status", o.Id), Module, "objective-status",
            $"{o.EmployeeDisplayName}'s objective is {(o.CurrentStatus == ObjectiveStatus.OffTrack ? "off track" : "at risk")}",
            o.Title, null, PerformanceNotificationTemplates.ObjectivePath(cycle.Id, o.Id),
            new FusionWorkSubjectDto(o.EmployeeDisplayName))));
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

    /// <summary>Feedback the caller was asked for and hasn't answered or declined, while the request is open. Not cycle-bound.</summary>
    private async Task FeedbackRequestsAsync(Guid employeeId, List<FusionWorkItemDto> items, CancellationToken token)
    {
        var waiting = await db.FeedbackRequests.AsNoTracking()
            .Where(r => r.State == Domain.Conversations.FeedbackRequestState.Open
                && r.Invitees.Any(i => i.EmployeeId == employeeId && i.Status == Domain.Conversations.FeedbackInviteeStatus.Waiting))
            .OrderBy(r => r.DueDate).ToListAsync(token);
        items.AddRange(waiting.Select(r => new FusionWorkItemDto(Id("feedback-request", r.Id), Module, "feedback-request",
            $"Feedback for {r.RequesterName}", r.Question, r.DueDate, PerformanceNotificationTemplates.FeedbackRequestPath(r.Id))));
    }

    /// <summary>The caller's open 1:1 action items in an active series, once due within three days or overdue. Not cycle-bound.</summary>
    private async Task OneOnOneActionsAsync(Guid employeeId, DateOnly today, List<FusionWorkItemDto> items, CancellationToken token)
    {
        var horizon = today.AddDays(3);
        var due = await (from action in db.OneOnOneActionItems.AsNoTracking()
                         join series in db.OneOnOneSeries.AsNoTracking() on action.SeriesId equals series.Id
                         where action.OwnerEmployeeId == employeeId && action.DoneAt == null && action.DueDate != null
                               && action.DueDate <= horizon && series.EndedAt == null
                               && (series.ManagerEmployeeId == employeeId || series.ReportEmployeeId == employeeId)
                         orderby action.DueDate
                         select new { ActionId = action.Id, action.Text, action.DueDate, SeriesId = series.Id, series.ManagerEmployeeId, series.ManagerName, series.ReportName })
            .ToListAsync(token);
        items.AddRange(due.Select(a => new FusionWorkItemDto(Id("one-on-one-action", a.ActionId), Module, "one-on-one-action", a.Text,
            $"1:1 with {(a.ManagerEmployeeId == employeeId ? a.ReportName : a.ManagerName)}", a.DueDate,
            PerformanceNotificationTemplates.OneOnOnePath(a.SeriesId))));
    }

    /// <summary>The round name, and how late the task is once past its current due date.</summary>
    private static string LateContext(string roundName, DateOnly? due, DateOnly today)
    {
        var late = ReviewReminderSchedule.DaysLate(due, today);
        return late switch { 0 => roundName, 1 => $"{roundName} · a day late", _ => $"{roundName} · {late} days late" };
    }

    /// <summary>
    /// Peer input work (D-18): the person nominates while self-assessing, the reviewer approves the list, each peer answers
    /// their open request, and the person acknowledges a released result.
    /// </summary>
    private async Task PeerWorkAsync(WorkActor actor, DateOnly today, List<FusionWorkItemDto> items, CancellationToken token)
    {
        var me = actor.EmployeeId;
        if (actor.Participates)
        {
            var nominate = await (from review in db.PerformanceReviews.AsNoTracking()
                                  join round in db.ReviewRounds.AsNoTracking() on review.ReviewRoundId equals round.Id
                                  where round.State == ReviewRoundState.Active && review.SubjectEmployeeId == me && review.PeerInputEnabled
                                        && review.State == PerformanceReviewState.SelfAssessment && review.SelfAssessment.SubmittedAt == null
                                        && review.PeersNominatedAt == null && review.PeerListApprovedAt == null
                                  select new { review.Id, review.SelfAssessmentDueDate, RoundName = round.Name }).ToListAsync(token);
            items.AddRange(nominate.Select(r => new FusionWorkItemDto(Id("nominate-peers", r.Id), Module, "nominate-peers",
                "Choose colleagues for peer input", r.RoundName, r.SelfAssessmentDueDate, PerformanceNotificationTemplates.ReviewPath(r.Id))));

            var asked = await (from request in db.PeerRequests.AsNoTracking()
                               join round in db.ReviewRounds.AsNoTracking() on request.ReviewRoundId equals round.Id
                               where round.State == ReviewRoundState.Active && request.PeerEmployeeId == me && request.State == PeerRequestState.Open
                               orderby request.DueDate
                               select new { request.Id, request.SubjectDisplayName, request.DueDate, RoundName = round.Name }).ToListAsync(token);
            items.AddRange(asked.Select(r => new FusionWorkItemDto(Id("peer-input", r.Id), Module, "peer-input",
                $"Peer input for {r.SubjectDisplayName}", LateContext(r.RoundName, r.DueDate, today), r.DueDate,
                PerformanceNotificationTemplates.PeerRequestPath(r.Id), new FusionWorkSubjectDto(r.SubjectDisplayName))));

            var unacknowledged = await (from review in db.PerformanceReviews.AsNoTracking()
                                        join round in db.ReviewRounds.AsNoTracking() on review.ReviewRoundId equals round.Id
                                        where review.SubjectEmployeeId == me && review.State == PerformanceReviewState.Finalized
                                              && review.AcknowledgedAt == null
                                        orderby review.FinalizedAt descending
                                        select new { review.Id, RoundName = round.Name }).ToListAsync(token);
            items.AddRange(unacknowledged.Select(r => new FusionWorkItemDto(Id("acknowledge-result", r.Id), Module, "acknowledge-result",
                "Read and acknowledge your review", r.RoundName, null, PerformanceNotificationTemplates.ReviewPath(r.Id))));
        }
        if (actor.ReviewsReports)
        {
            var lists = await (from review in db.PerformanceReviews.AsNoTracking()
                               join round in db.ReviewRounds.AsNoTracking() on review.ReviewRoundId equals round.Id
                               where round.State == ReviewRoundState.Active && review.ReviewerEmployeeId == me && review.PeerInputEnabled
                                     && review.PeersNominatedAt != null && review.PeerListApprovedAt == null
                                     && review.ManagerAssessment.SubmittedAt == null
                                     && (review.State == PerformanceReviewState.SelfAssessment || review.State == PerformanceReviewState.ManagerAssessment)
                               orderby review.PeersNominatedAt
                               select new { review.Id, review.SubjectDisplayName, Due = review.SelfAssessmentDueDate ?? round.SelfAssessmentDueDate, RoundName = round.Name })
                .ToListAsync(token);
            items.AddRange(lists.Select(r => new FusionWorkItemDto(Id("approve-peer-list", r.Id), Module, "approve-peer-list",
                $"Review {r.SubjectDisplayName}'s peer list", LateContext(r.RoundName, r.Due, today), r.Due,
                PerformanceNotificationTemplates.PeerListPath(r.Id), new FusionWorkSubjectDto(r.SubjectDisplayName))));
        }
    }

    /// <summary>The review work queue's own rule: the subject in self-assessment, the reviewer in manager assessment.</summary>
    private async Task AssessmentsAsync(WorkActor actor, DateOnly today, List<FusionWorkItemDto> items, CancellationToken token)
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
                LateContext(review.RoundName, review.CurrentStageDueDate, today), review.CurrentStageDueDate,
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
