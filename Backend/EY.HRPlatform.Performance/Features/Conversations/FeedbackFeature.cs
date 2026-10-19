using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Conversations;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using FeedbackEntity = EY.HRPlatform.Performance.Domain.Conversations.Feedback;

namespace EY.HRPlatform.Performance.Features.Conversations;

// ── Contracts ────────────────────────────────────────────────────────────────

/// <summary>What feedback or a request is about, with the name the viewer reads and where it opens.</summary>
public sealed record FeedbackSubjectDto(FeedbackSubjectKind Kind, Guid? CycleId, Guid? ObjectiveId, Guid? CompetencyId, string Label, string? Href);

public sealed record FeedbackDto(
    Guid Id,
    PersonRefDto Author,
    PersonRefDto Receiver,
    FeedbackVisibility Visibility,
    // Only for manager-only feedback, and only to its author and its addressee.
    PersonRefDto? AddressedManager,
    FeedbackSubjectDto? Subject,
    string Message,
    Guid? RequestId,
    string? RequestQuestion,
    DateTime SentAt);

public sealed record FeedbackPageDto(IReadOnlyList<FeedbackDto> Items, string? Next);

public enum FeedbackView { Received = 0, Team = 1, Given = 2 }

public sealed record GiveFeedbackRequest(Guid Id, Guid ReceiverEmployeeId, FeedbackVisibility Visibility, string Message,
    Guid? CompetencyId, Guid? CycleId, Guid? ObjectiveId);

public sealed record FeedbackInviteeDto(PersonRefDto Person, FeedbackInviteeStatus Status, DateTime? RespondedAt, string? DeclineReason);

public sealed record FeedbackRequestCapabilitiesDto(bool Answer, bool Decline, bool Close);

/// <summary>
/// A feedback request as the caller may see it. The requester, their manager and administrators get every invitee and
/// answer. An invitee gets the question and their own part only: <see cref="Invitees"/> and <see cref="Answers"/> are null.
/// </summary>
public sealed record FeedbackRequestDto(
    Guid Id,
    uint Version,
    PersonRefDto Requester,
    string Question,
    FeedbackSubjectDto? Subject,
    DateOnly DueDate,
    FeedbackRequestState State,
    DateTime RequestedAt,
    DateTime? ClosedAt,
    FeedbackRequestCloseReason? CloseReason,
    bool Overdue,
    // "Requester", "Invitee" or "Viewer" (the requester's manager or an administrator).
    string ViewerRole,
    IReadOnlyList<FeedbackInviteeDto>? Invitees,
    IReadOnlyList<FeedbackDto>? Answers,
    FeedbackInviteeDto? Mine,
    FeedbackDto? MyAnswer,
    FeedbackRequestCapabilitiesDto Can);

/// <summary>A request in the Requests tab: those to answer show the requester, the caller's own show the progress.</summary>
public sealed record FeedbackRequestRowDto(Guid Id, string Question, PersonRefDto Requester, DateOnly DueDate, FeedbackRequestState State,
    bool Overdue, int Answered, int Declined, int Invited, FeedbackInviteeStatus? MyStatus, DateTime RequestedAt)
{
    public FeedbackSubjectDto? Subject { get; init; }
    /// <summary>Who was asked and where each stands; only on the caller's own requests.</summary>
    public IReadOnlyList<FeedbackInviteeDto>? Invitees { get; init; }
    /// <summary>The most recent answer; only on the caller's own requests.</summary>
    public FeedbackDto? LatestAnswer { get; init; }
}

public sealed record FeedbackRequestsDto(IReadOnlyList<FeedbackRequestRowDto> ToAnswer, IReadOnlyList<FeedbackRequestRowDto> Mine);

/// <summary>Received feedback counted by what it was about; <see cref="Label"/> is null when it was about nothing specific.</summary>
public sealed record FeedbackSubjectCountDto(FeedbackSubjectKind Kind, Guid? ObjectiveId, Guid? CompetencyId, string? Label, int Count);

/// <summary>One of the caller's objectives in the active cycle, with how much feedback it has drawn.</summary>
public sealed record FeedbackAskAboutDto(Guid CycleId, Guid ObjectiveId, string Title, ObjectiveStatus? Status, int Feedback);

/// <summary>
/// The caller's feedback at a glance: what they received, from how many colleagues and about what; what they gave; the
/// requests waiting on them; and the objectives that have drawn the least feedback, to ask about next.
/// </summary>
public sealed record FeedbackSummaryDto(int Received, int FromCount, IReadOnlyList<PersonRefDto> From, IReadOnlyList<FeedbackSubjectCountDto> Subjects,
    int Given, int ToAnswer, IReadOnlyList<FeedbackAskAboutDto> AskAbout);

public sealed record AskForFeedbackRequest(Guid Id, string Question, IReadOnlyList<Guid> InviteeEmployeeIds, DateOnly DueDate,
    Guid? CompetencyId, Guid? CycleId, Guid? ObjectiveId);
public sealed record AnswerFeedbackRequest(Guid FeedbackId, string Message);
public sealed record DeclineFeedbackRequest(string? Reason);

/// <summary>The caller, from the token: who they are and what they hold.</summary>
public sealed record FeedbackActor(Guid EmployeeId, bool IsAdministrator, bool ReviewsReports, bool ManagesOrgObjectives = false,
    bool PublishesStrategy = false);

public sealed record GiveFeedbackCommand(GiveFeedbackRequest Request, FeedbackActor Actor) : ICommand<Result<FeedbackDto>>;
public sealed record GetFeedbackQuery(Guid FeedbackId, FeedbackActor Actor) : IQuery<Result<FeedbackDto>>;
public sealed record ListFeedbackQuery(FeedbackView View, Guid? CycleId, Guid? ObjectiveId, string? Before, int Limit, FeedbackActor Actor)
    : IQuery<Result<FeedbackPageDto>>;
public sealed record AskForFeedbackCommand(AskForFeedbackRequest Request, FeedbackActor Actor) : ICommand<Result<FeedbackRequestDto>>;
public sealed record GetFeedbackRequestQuery(Guid RequestId, FeedbackActor Actor) : IQuery<Result<FeedbackRequestDto>>;
public sealed record ListFeedbackRequestsQuery(FeedbackActor Actor) : IQuery<Result<FeedbackRequestsDto>>;
public sealed record GetFeedbackSummaryQuery(FeedbackActor Actor) : IQuery<Result<FeedbackSummaryDto>>;
public sealed record AnswerFeedbackRequestCommand(Guid RequestId, AnswerFeedbackRequest Request, FeedbackActor Actor) : ICommand<Result<FeedbackRequestDto>>;
public sealed record DeclineFeedbackRequestCommand(Guid RequestId, DeclineFeedbackRequest Request, FeedbackActor Actor) : ICommand<Result<FeedbackRequestDto>>;
public sealed record CloseFeedbackRequestCommand(Guid RequestId, FeedbackActor Actor) : ICommand<Result<FeedbackRequestDto>>;

// ── Shared reads ─────────────────────────────────────────────────────────────

/// <summary>Projection and validation shared by feedback and requests, and by the person summary and objective record.</summary>
public sealed class FeedbackReader(PerformanceDbContext db, PerformanceViewer viewer)
{
    /// <summary>The caller as a feedback reader. Core HR being down narrows it to the rules that don't need Core.</summary>
    public async Task<FeedbackViewer> ViewerAsync(FeedbackActor actor, CancellationToken token)
    {
        IReadOnlySet<Guid> reports = new HashSet<Guid>();
        if (actor.ReviewsReports && actor.EmployeeId != Guid.Empty)
        {
            try { reports = (await viewer.CurrentLineAsync(token)).DirectReportIds; }
            catch (HttpRequestException) { /* Current-manager reads wait for Core; addressee reads still work. */ }
        }
        return FeedbackViewer.For(actor.EmployeeId, actor.IsAdministrator, actor.ReviewsReports, reports);
    }

    public async Task<IReadOnlyList<FeedbackDto>> ProjectAsync(IReadOnlyList<FeedbackEntity> items, FeedbackViewer reader, CancellationToken token)
    {
        var competencyIds = items.Select(f => f.CompetencyId).OfType<Guid>().Distinct().ToList();
        var competencies = competencyIds.Count == 0 ? []
            : await db.Competencies.AsNoTracking().Where(c => competencyIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Name, token);
        var requestIds = items.Select(f => f.RequestId).OfType<Guid>().Distinct().ToList();
        var questions = requestIds.Count == 0 ? []
            : await db.FeedbackRequests.AsNoTracking().Where(r => requestIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, r => r.Question, token);
        return items.Select(f => new FeedbackDto(f.Id, new PersonRefDto(f.AuthorEmployeeId, f.AuthorName),
            new PersonRefDto(f.ReceiverEmployeeId, f.ReceiverName), f.Visibility,
            f.Visibility == FeedbackVisibility.ManagerOnly && f.AddressedManagerEmployeeId is Guid m
                ? new PersonRefDto(m, f.AddressedManagerName) : null,
            Subject(f.Subject, competencies), f.Message, f.RequestId,
            f.RequestId is Guid r ? questions.GetValueOrDefault(r) : null, f.SentAt)).ToList();
    }

    public static FeedbackSubjectDto? Subject(FeedbackSubject subject, IReadOnlyDictionary<Guid, string> competencies) => subject switch
    {
        { Kind: FeedbackSubjectKind.Objective, CycleId: Guid cycle, ObjectiveId: Guid objective } => new(subject.Kind, cycle, objective, null,
            subject.ObjectiveTitle ?? "An objective", PerformanceNotificationTemplates.ObjectivePath(cycle, objective)),
        { Kind: FeedbackSubjectKind.Competency, CompetencyId: Guid competency } => new(subject.Kind, null, null, competency,
            competencies.GetValueOrDefault(competency) ?? "A competency", null),
        _ => null,
    };

    /// <summary>
    /// Validates a subject: an active competency (marked used), or an objective the author can read that is either
    /// <paramref name="ownedBy"/>'s own or published direction. Its title is frozen into the subject.
    /// </summary>
    public async Task<Result<FeedbackSubject>> SubjectAsync(Guid? competencyId, Guid? cycleId, Guid? objectiveId, Guid ownedBy,
        FeedbackActor actor, string invalidCode, CancellationToken token)
    {
        if (competencyId is not null && objectiveId is not null)
            return Result.Failure<FeedbackSubject>(PerformanceErrors.Validation(invalidCode, "Choose one objective or one competency."));
        if (competencyId is Guid competencyKey)
        {
            var competency = await db.Competencies.FirstOrDefaultAsync(c => c.Id == competencyKey && c.State == CompetencyState.Active, token);
            if (competency is null) return Result.Failure<FeedbackSubject>(PerformanceErrors.Validation(invalidCode, "Choose an active competency."));
            competency.MarkUsed(DateTime.UtcNow);
            return Result.Success(new FeedbackSubject(FeedbackSubjectKind.Competency, CompetencyId: competency.Id));
        }
        if (objectiveId is not Guid objectiveKey) return Result.Success(FeedbackSubject.None);

        var unknown = Result.Failure<FeedbackSubject>(PerformanceErrors.Validation(invalidCode,
            "Feedback can be about their own objective or published direction."));
        if (cycleId is not Guid cycleKey) return unknown;
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cycleKey && c.State != CycleLifecycleState.Draft, token);
        var objective = cycle is null ? null : await db.Objectives.AsNoTracking().FirstOrDefaultAsync(o => o.Id == objectiveKey && o.CycleId == cycleKey, token);
        if (cycle is null || objective is null) return unknown;
        var plan = objective.EmployeePlanId is Guid planId
            ? await db.EmployeePlans.AsNoTracking().Include(p => p.Decisions).FirstOrDefaultAsync(p => p.Id == planId, token)
            : null;
        var goalActor = new GoalActorContext(actor.EmployeeId, actor.IsAdministrator, actor.ManagesOrgObjectives, actor.ReviewsReports, actor.PublishesStrategy);
        var cycleViewer = await viewer.ForCycleAsync(cycle, goalActor, token);
        var published = objective.OwnershipScope is ObjectiveOwnershipScope.Company or ObjectiveOwnershipScope.OrgUnit
            && objective.State is ObjectiveLifecycleState.Published or ObjectiveLifecycleState.Archived;
        if (!ObjectivePolicy.CanRead(cycleViewer, objective, plan) || !(published || objective.AccountablePersonId == ownedBy)) return unknown;
        return Result.Success(new FeedbackSubject(FeedbackSubjectKind.Objective, cycle.Id, objective.Id, objective.Title));
    }

    public static string? SubjectLabel(FeedbackSubject subject, string? competencyName) => subject.Kind switch
    {
        FeedbackSubjectKind.Objective => subject.ObjectiveTitle,
        FeedbackSubjectKind.Competency => competencyName,
        _ => null,
    };
}

// ── Feedback ─────────────────────────────────────────────────────────────────

public sealed class GiveFeedbackHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, PerformanceViewer viewer, ITenantContext tenant,
    IPerformanceAudit audit, IPerformanceNotifications notifications)
    : ICommandHandler<GiveFeedbackCommand, Result<FeedbackDto>>
{
    public async Task<Result<FeedbackDto>> Handle(GiveFeedbackCommand command, CancellationToken token)
    {
        var request = command.Request;
        var me = command.Actor.EmployeeId;
        var reader = new FeedbackReader(db, viewer);

        // A retried send returns the original; someone else's id is a conflict that reveals nothing.
        var existing = await db.Feedback.AsNoTracking().FirstOrDefaultAsync(f => f.Id == request.Id, token);
        if (existing is not null)
            return existing.AuthorEmployeeId == me
                ? Result.Success((await reader.ProjectAsync([existing], await reader.ViewerAsync(command.Actor, token), token))[0])
                : Result.Failure<FeedbackDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.FeedbackIdConflict, "Send it again from a fresh form."));
        if (request.ReceiverEmployeeId == me)
            return Result.Failure<FeedbackDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.FeedbackInvalid, "Give feedback to someone else."));

        var people = await workforce.ResolveAsync(DateTime.UtcNow, [request.ReceiverEmployeeId, me], token);
        var receiver = people.FirstOrDefault(p => p.EmployeeId == request.ReceiverEmployeeId);
        var author = people.FirstOrDefault(p => p.EmployeeId == me);
        if (receiver is not { IsActive: true } || author is null)
            return Result.Failure<FeedbackDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.FeedbackReceiverUnavailable,
                "They aren't an active colleague in this company."));

        var subject = await reader.SubjectAsync(request.CompetencyId, request.CycleId, request.ObjectiveId, receiver.EmployeeId,
            command.Actor, PerformanceErrors.Codes.FeedbackInvalid, token);
        if (subject.IsFailure) return Result.Failure<FeedbackDto>(subject.Error);

        var manager = receiver.Manager is { IsActive: true } m ? m : null;
        FeedbackEntity feedback;
        try
        {
            feedback = FeedbackEntity.Give(request.Id, tenant.TenantId, me, author.DisplayName, receiver.EmployeeId, receiver.DisplayName,
                request.Visibility, manager?.EmployeeId, manager?.DisplayName, subject.Value, request.Message, DateTime.UtcNow);
        }
        catch (FeedbackNoManagerException ex)
        {
            return Result.Failure<FeedbackDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.FeedbackNoManager, ex.Message));
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<FeedbackDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.FeedbackInvalid, ex.Message));
        }
        db.Feedback.Add(feedback);
        audit.Record(feedback.TenantId, "Feedback", feedback.Id, feedback.CycleId, PerformanceAuditActions.FeedbackGiven,
            new { authorEmployeeId = me, receiverEmployeeId = feedback.ReceiverEmployeeId, visibility = feedback.Visibility.ToString(),
                subjectKind = feedback.SubjectKind.ToString() });

        var competencyName = feedback.CompetencyId is Guid c ? (await db.Competencies.AsNoTracking().FirstAsync(x => x.Id == c, token)).Name : null;
        if (feedback.Visibility == FeedbackVisibility.Shared)
            notifications.EnqueueConversation(feedback.TenantId, PerformanceNotificationKind.FeedbackReceived, feedback.ReceiverEmployeeId, me,
                "Feedback", feedback.Id, feedback.Id, PerformanceNotificationTemplates.ForFeedbackReceived(author.DisplayName,
                    FeedbackReader.SubjectLabel(feedback.Subject, competencyName), feedback.Id));
        else if (feedback.AddressedManagerEmployeeId is Guid addressee)
            notifications.EnqueueConversation(feedback.TenantId, PerformanceNotificationKind.FeedbackForReport, addressee, me,
                "Feedback", feedback.Id, feedback.Id, PerformanceNotificationTemplates.ForFeedbackForReport(author.DisplayName, receiver.DisplayName, feedback.Id));

        await db.SaveChangesAsync(token);
        return Result.Success((await reader.ProjectAsync([feedback], await reader.ViewerAsync(command.Actor, token), token))[0]);
    }
}

public sealed class GetFeedbackHandler(PerformanceDbContext db, PerformanceViewer viewer) : IQueryHandler<GetFeedbackQuery, Result<FeedbackDto>>
{
    public async Task<Result<FeedbackDto>> Handle(GetFeedbackQuery query, CancellationToken token)
    {
        var reader = new FeedbackReader(db, viewer);
        var who = await reader.ViewerAsync(query.Actor, token);
        var feedback = await FeedbackPolicy.Readable(db.Feedback.AsNoTracking(), who).FirstOrDefaultAsync(f => f.Id == query.FeedbackId, token);
        return feedback is null
            ? Result.Failure<FeedbackDto>(PerformanceErrors.NotFound("Feedback", query.FeedbackId))
            : Result.Success((await reader.ProjectAsync([feedback], who, token))[0]);
    }
}

public sealed class ListFeedbackHandler(PerformanceDbContext db, PerformanceViewer viewer) : IQueryHandler<ListFeedbackQuery, Result<FeedbackPageDto>>
{
    public const int MaxLimit = 50;

    public async Task<Result<FeedbackPageDto>> Handle(ListFeedbackQuery query, CancellationToken token)
    {
        var reader = new FeedbackReader(db, viewer);
        var who = await reader.ViewerAsync(query.Actor, token);
        var me = who.EmployeeId;
        var items = FeedbackPolicy.Readable(db.Feedback.AsNoTracking(), who);
        if (query.ObjectiveId is Guid objectiveId)
            items = items.Where(f => f.ObjectiveId == objectiveId && (query.CycleId == null || f.CycleId == query.CycleId));
        else
        {
            var reports = who.DirectReportIds.ToList();
            items = query.View switch
            {
                FeedbackView.Given => items.Where(f => f.AuthorEmployeeId == me),
                FeedbackView.Team => who.ReviewsReports
                    ? items.Where(f => f.ReceiverEmployeeId != me && (reports.Contains(f.ReceiverEmployeeId) || f.AddressedManagerEmployeeId == me))
                    : items.Where(_ => false),
                _ => items.Where(f => f.ReceiverEmployeeId == me),
            };
        }
        if (Cursor.Parse(query.Before) is DateTime before) items = items.Where(f => f.SentAt < before);
        var limit = Math.Clamp(query.Limit, 1, MaxLimit);
        var page = await items.OrderByDescending(f => f.SentAt).Take(limit + 1).ToListAsync(token);
        var more = page.Count > limit;
        if (more) page.RemoveAt(page.Count - 1);
        return Result.Success(new FeedbackPageDto(await reader.ProjectAsync(page, who, token), more ? Cursor.Format(page[^1].SentAt) : null));
    }
}

/// <summary>A keyset cursor over the sending time, opaque to clients (ticks; sends never share a tick for one reader).</summary>
public static class Cursor
{
    public static string Format(DateTime at) => at.Ticks.ToString(System.Globalization.CultureInfo.InvariantCulture);

    public static DateTime? Parse(string? value)
        => long.TryParse(value, System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out var ticks)
            && ticks > 0 && ticks <= DateTime.MaxValue.Ticks ? new DateTime(ticks, DateTimeKind.Utc) : null;
}

// ── Requests ─────────────────────────────────────────────────────────────────

public abstract class FeedbackRequestHandlerBase(PerformanceDbContext db, PerformanceViewer viewer)
{
    protected PerformanceDbContext Db => db;
    protected FeedbackReader Reader { get; } = new(db, viewer);

    protected static Result<FeedbackRequestDto> NotFound(Guid id) => Result.Failure<FeedbackRequestDto>(PerformanceErrors.NotFound("FeedbackRequest", id));

    /// <summary>The full view for the requester, their manager and administrators; the invitee's own part; or not found.</summary>
    protected async Task<Result<FeedbackRequestDto>> ProjectAsync(Guid requestId, FeedbackActor actor, CancellationToken token)
    {
        var request = await db.FeedbackRequests.AsNoTracking().FirstOrDefaultAsync(r => r.Id == requestId, token);
        if (request is null) return NotFound(requestId);
        var who = await Reader.ViewerAsync(actor, token);
        var me = actor.EmployeeId;
        var full = FeedbackRequestPolicy.CanReadAll(request, who);
        var invitee = request.InviteeFor(me);
        if (!full && invitee is null) return NotFound(requestId);

        var competencies = request.CompetencyId is Guid c
            ? await db.Competencies.AsNoTracking().Where(x => x.Id == c).ToDictionaryAsync(x => x.Id, x => x.Name, token)
            : new Dictionary<Guid, string>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var open = request.State == FeedbackRequestState.Open;
        var answerIds = request.Invitees.Select(i => i.FeedbackId).OfType<Guid>().ToList();
        var answers = await db.Feedback.AsNoTracking().Where(f => answerIds.Contains(f.Id)).OrderBy(f => f.SentAt).ToListAsync(token);
        var projected = await Reader.ProjectAsync(answers, who, token);

        FeedbackInviteeDto Invitee(FeedbackRequestInvitee i)
            => new(new PersonRefDto(i.EmployeeId, i.Name), i.Status, i.RespondedAt, i.DeclineReason);

        var role = request.RequesterEmployeeId == me ? "Requester" : full ? "Viewer" : "Invitee";
        var waiting = invitee?.Status == FeedbackInviteeStatus.Waiting;
        return Result.Success(new FeedbackRequestDto(request.Id, request.Version, new PersonRefDto(request.RequesterEmployeeId, request.RequesterName),
            request.Question, FeedbackReader.Subject(request.Subject, competencies), request.DueDate, request.State, request.RequestedAt,
            request.ClosedAt, request.CloseReason, open && request.DueDate < today, role,
            full ? request.Invitees.OrderBy(i => i.Name).Select(Invitee).ToList() : null,
            full ? projected : null,
            invitee is null ? null : Invitee(invitee),
            invitee?.FeedbackId is Guid mine ? projected.FirstOrDefault(p => p.Id == mine) : null,
            new FeedbackRequestCapabilitiesDto(open && waiting, open && waiting, open && request.RequesterEmployeeId == me)));
    }
}

public sealed class AskForFeedbackHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, PerformanceViewer viewer, ITenantContext tenant,
    IPerformanceAudit audit, IPerformanceNotifications notifications)
    : FeedbackRequestHandlerBase(db, viewer), ICommandHandler<AskForFeedbackCommand, Result<FeedbackRequestDto>>
{
    public async Task<Result<FeedbackRequestDto>> Handle(AskForFeedbackCommand command, CancellationToken token)
    {
        var request = command.Request;
        var me = command.Actor.EmployeeId;
        var existing = await Db.FeedbackRequests.AsNoTracking().FirstOrDefaultAsync(r => r.Id == request.Id, token);
        if (existing is not null)
            return existing.RequesterEmployeeId == me ? await ProjectAsync(existing.Id, command.Actor, token)
                : Result.Failure<FeedbackRequestDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.FeedbackIdConflict, "Send it again from a fresh form."));

        var wanted = (request.InviteeEmployeeIds ?? []).Distinct().ToList();
        if (wanted.Count is 0 or > FeedbackRequest.MaxInvitees)
            return Invalid($"Ask 1 to {FeedbackRequest.MaxInvitees} colleagues.");
        if (wanted.Contains(me)) return Invalid("Ask colleagues other than yourself.");
        var people = await workforce.ResolveAsync(DateTime.UtcNow, [.. wanted, me], token);
        var requester = people.FirstOrDefault(p => p.EmployeeId == me);
        var invitees = wanted.Select(id => people.FirstOrDefault(p => p.EmployeeId == id)).ToList();
        if (requester is null || invitees.Any(i => i is not { IsActive: true }))
            return Result.Failure<FeedbackRequestDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.FeedbackReceiverUnavailable,
                "Everyone you ask needs to be an active colleague in this company."));

        var subject = await Reader.SubjectAsync(request.CompetencyId, request.CycleId, request.ObjectiveId, me, command.Actor,
            PerformanceErrors.Codes.FeedbackInvalid, token);
        if (subject.IsFailure) return Result.Failure<FeedbackRequestDto>(subject.Error);

        FeedbackRequest created;
        try
        {
            created = FeedbackRequest.Ask(request.Id, tenant.TenantId, me, requester.DisplayName, request.Question, subject.Value, request.DueDate,
                invitees.Select(i => (i!.EmployeeId, i.DisplayName)).ToList(), DateOnly.FromDateTime(DateTime.UtcNow), DateTime.UtcNow);
        }
        catch (ArgumentException ex) { return Invalid(ex.Message); }
        Db.FeedbackRequests.Add(created);
        audit.Record(created.TenantId, "FeedbackRequest", created.Id, created.CycleId, PerformanceAuditActions.FeedbackRequested,
            new { requesterEmployeeId = me, inviteeEmployeeIds = created.Invitees.Select(i => i.EmployeeId).ToList(), dueDate = created.DueDate,
                subjectKind = created.SubjectKind.ToString() });
        foreach (var invitee in created.Invitees)
            notifications.EnqueueConversation(created.TenantId, PerformanceNotificationKind.FeedbackRequested, invitee.EmployeeId, me,
                "FeedbackRequest", created.Id, created.Id,
                PerformanceNotificationTemplates.ForFeedbackRequested(created.RequesterName, created.Question, created.Id));
        await Db.SaveChangesAsync(token);
        return await ProjectAsync(created.Id, command.Actor, token);
    }

    private static Result<FeedbackRequestDto> Invalid(string message)
        => Result.Failure<FeedbackRequestDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.FeedbackInvalid, message));
}

public sealed class GetFeedbackRequestHandler(PerformanceDbContext db, PerformanceViewer viewer)
    : FeedbackRequestHandlerBase(db, viewer), IQueryHandler<GetFeedbackRequestQuery, Result<FeedbackRequestDto>>
{
    public Task<Result<FeedbackRequestDto>> Handle(GetFeedbackRequestQuery query, CancellationToken token) => ProjectAsync(query.RequestId, query.Actor, token);
}

public sealed class ListFeedbackRequestsHandler(PerformanceDbContext db, PerformanceViewer viewer)
    : IQueryHandler<ListFeedbackRequestsQuery, Result<FeedbackRequestsDto>>
{
    public async Task<Result<FeedbackRequestsDto>> Handle(ListFeedbackRequestsQuery query, CancellationToken token)
    {
        var me = query.Actor.EmployeeId;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var toAnswer = await db.FeedbackRequests.AsNoTracking().Where(r => r.Invitees.Any(i => i.EmployeeId == me)).ToListAsync(token);
        var mine = await db.FeedbackRequests.AsNoTracking().Where(r => r.RequesterEmployeeId == me).ToListAsync(token);

        var competencyIds = toAnswer.Concat(mine).Select(r => r.CompetencyId).OfType<Guid>().Distinct().ToList();
        var competencies = competencyIds.Count == 0 ? []
            : await db.Competencies.AsNoTracking().Where(c => competencyIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Name, token);
        // Answers are shared feedback to the requester, so the requester reads every one of them.
        var answerIds = mine.SelectMany(r => r.Invitees).Select(i => i.FeedbackId).OfType<Guid>().ToList();
        var answers = answerIds.Count == 0 ? []
            : await new FeedbackReader(db, viewer).ProjectAsync(
                await db.Feedback.AsNoTracking().Where(f => answerIds.Contains(f.Id)).ToListAsync(token),
                FeedbackViewer.For(me, isAdministrator: false, reviewsReports: false, null), token);
        var latest = answers.Where(a => a.RequestId is not null).GroupBy(a => a.RequestId!.Value)
            .ToDictionary(g => g.Key, g => g.MaxBy(a => a.SentAt));

        FeedbackRequestRowDto Row(FeedbackRequest r, bool asInvitee)
        {
            var open = r.State == FeedbackRequestState.Open;
            // An invitee sees the request, not who else was asked: the counts and people are only for the requester.
            return new FeedbackRequestRowDto(r.Id, r.Question, new PersonRefDto(r.RequesterEmployeeId, r.RequesterName), r.DueDate, r.State,
                open && r.DueDate < today,
                asInvitee ? 0 : r.Invitees.Count(i => i.Status == FeedbackInviteeStatus.Answered),
                asInvitee ? 0 : r.Invitees.Count(i => i.Status == FeedbackInviteeStatus.Declined),
                asInvitee ? 0 : r.Invitees.Count,
                asInvitee ? r.InviteeFor(me)?.Status : null, r.RequestedAt)
            {
                Subject = FeedbackReader.Subject(r.Subject, competencies),
                Invitees = asInvitee ? null : r.Invitees.OrderBy(i => i.Name)
                    .Select(i => new FeedbackInviteeDto(new PersonRefDto(i.EmployeeId, i.Name), i.Status, i.RespondedAt, i.DeclineReason)).ToList(),
                LatestAnswer = asInvitee ? null : latest.GetValueOrDefault(r.Id),
            };
        }

        // Open before closed; within each, the earliest due first for those to answer and the newest first for one's own.
        return Result.Success(new FeedbackRequestsDto(
            toAnswer.OrderBy(r => r.InviteeFor(me)?.Status != FeedbackInviteeStatus.Waiting || r.State != FeedbackRequestState.Open)
                .ThenBy(r => r.DueDate).Select(r => Row(r, asInvitee: true)).ToList(),
            mine.OrderBy(r => r.State != FeedbackRequestState.Open).ThenByDescending(r => r.RequestedAt).Select(r => Row(r, asInvitee: false)).ToList()));
    }
}

public sealed class AnswerFeedbackRequestHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, PerformanceViewer viewer,
    IPerformanceAudit audit, IPerformanceNotifications notifications)
    : FeedbackRequestHandlerBase(db, viewer), ICommandHandler<AnswerFeedbackRequestCommand, Result<FeedbackRequestDto>>
{
    public async Task<Result<FeedbackRequestDto>> Handle(AnswerFeedbackRequestCommand command, CancellationToken token)
    {
        var me = command.Actor.EmployeeId;
        var request = await Db.FeedbackRequests.FirstOrDefaultAsync(r => r.Id == command.RequestId, token);
        var invitee = request?.InviteeFor(me);
        if (request is null || invitee is null) return NotFound(command.RequestId);
        // A second response returns the first; nothing changes.
        if (invitee.Status != FeedbackInviteeStatus.Waiting) return await ProjectAsync(request.Id, command.Actor, token);
        if (request.State == FeedbackRequestState.Closed)
            return Result.Failure<FeedbackRequestDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.FeedbackRequestClosed, "This request is closed."));

        // The answer is shared feedback to the requester, addressed to their manager now.
        var people = await workforce.ResolveAsync(DateTime.UtcNow, [request.RequesterEmployeeId], token);
        var requester = people.FirstOrDefault(p => p.EmployeeId == request.RequesterEmployeeId);
        var manager = requester?.Manager is { IsActive: true } m ? m : null;
        FeedbackEntity answer;
        try
        {
            answer = FeedbackEntity.Give(command.Request.FeedbackId, request.TenantId, me, invitee.Name, request.RequesterEmployeeId,
                request.RequesterName, FeedbackVisibility.Shared, manager?.EmployeeId, manager?.DisplayName, request.Subject,
                command.Request.Message, DateTime.UtcNow, request.Id);
            request.RecordAnswer(me, answer.Id, DateTime.UtcNow);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<FeedbackRequestDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.FeedbackInvalid, ex.Message));
        }
        if (await Db.Feedback.AnyAsync(f => f.Id == answer.Id, token))
            return Result.Failure<FeedbackRequestDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.FeedbackIdConflict, "Send it again from a fresh form."));
        Db.Feedback.Add(answer);
        audit.Record(request.TenantId, "FeedbackRequest", request.Id, request.CycleId, PerformanceAuditActions.FeedbackRequestAnswered,
            new { inviteeEmployeeId = me, feedbackId = answer.Id });
        if (request.State == FeedbackRequestState.Closed)
            audit.Record(request.TenantId, "FeedbackRequest", request.Id, request.CycleId, PerformanceAuditActions.FeedbackRequestClosed,
                new { reason = request.CloseReason.ToString() });
        notifications.EnqueueConversation(request.TenantId, PerformanceNotificationKind.FeedbackRequestResponded, request.RequesterEmployeeId, me,
            "FeedbackRequest", request.Id, answer.Id,
            PerformanceNotificationTemplates.ForFeedbackRequestResponded(invitee.Name, answered: true, request.Question, request.Id));
        try { await Db.SaveChangesAsync(token); }
        catch (DbUpdateConcurrencyException) { return Result.Failure<FeedbackRequestDto>(PerformanceErrors.Changed()); }
        return await ProjectAsync(request.Id, command.Actor, token);
    }
}

public sealed class DeclineFeedbackRequestHandler(PerformanceDbContext db, PerformanceViewer viewer, IPerformanceAudit audit,
    IPerformanceNotifications notifications)
    : FeedbackRequestHandlerBase(db, viewer), ICommandHandler<DeclineFeedbackRequestCommand, Result<FeedbackRequestDto>>
{
    public async Task<Result<FeedbackRequestDto>> Handle(DeclineFeedbackRequestCommand command, CancellationToken token)
    {
        var me = command.Actor.EmployeeId;
        var request = await Db.FeedbackRequests.FirstOrDefaultAsync(r => r.Id == command.RequestId, token);
        var invitee = request?.InviteeFor(me);
        if (request is null || invitee is null) return NotFound(command.RequestId);
        if (invitee.Status != FeedbackInviteeStatus.Waiting) return await ProjectAsync(request.Id, command.Actor, token);
        try { request.Decline(me, command.Request.Reason, DateTime.UtcNow); }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<FeedbackRequestDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.FeedbackRequestClosed, ex.Message));
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<FeedbackRequestDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.FeedbackInvalid, ex.Message));
        }
        audit.Record(request.TenantId, "FeedbackRequest", request.Id, request.CycleId, PerformanceAuditActions.FeedbackRequestDeclined,
            new { inviteeEmployeeId = me });
        if (request.State == FeedbackRequestState.Closed)
            audit.Record(request.TenantId, "FeedbackRequest", request.Id, request.CycleId, PerformanceAuditActions.FeedbackRequestClosed,
                new { reason = request.CloseReason.ToString() });
        var transition = new Guid(System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes($"decline:{request.Id:N}:{me:N}")));
        notifications.EnqueueConversation(request.TenantId, PerformanceNotificationKind.FeedbackRequestResponded, request.RequesterEmployeeId, me,
            "FeedbackRequest", request.Id, transition,
            PerformanceNotificationTemplates.ForFeedbackRequestResponded(invitee.Name, answered: false, request.Question, request.Id));
        try { await Db.SaveChangesAsync(token); }
        catch (DbUpdateConcurrencyException) { return Result.Failure<FeedbackRequestDto>(PerformanceErrors.Changed()); }
        return await ProjectAsync(request.Id, command.Actor, token);
    }
}

public sealed class CloseFeedbackRequestHandler(PerformanceDbContext db, PerformanceViewer viewer, IPerformanceAudit audit)
    : FeedbackRequestHandlerBase(db, viewer), ICommandHandler<CloseFeedbackRequestCommand, Result<FeedbackRequestDto>>
{
    public async Task<Result<FeedbackRequestDto>> Handle(CloseFeedbackRequestCommand command, CancellationToken token)
    {
        var request = await Db.FeedbackRequests.FirstOrDefaultAsync(r => r.Id == command.RequestId, token);
        if (request is null) return NotFound(command.RequestId);
        if (request.RequesterEmployeeId != command.Actor.EmployeeId)
        {
            var who = await Reader.ViewerAsync(command.Actor, token);
            return FeedbackRequestPolicy.CanReadAll(request, who) || FeedbackRequestPolicy.IsInvitee(request, command.Actor.EmployeeId)
                ? Result.Failure<FeedbackRequestDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.FeedbackRequestForbidden,
                    "Only the person who asked closes the request."))
                : NotFound(command.RequestId);
        }
        if (request.Close(command.Actor.EmployeeId, DateTime.UtcNow))
        {
            audit.Record(request.TenantId, "FeedbackRequest", request.Id, request.CycleId, PerformanceAuditActions.FeedbackRequestClosed,
                new { reason = request.CloseReason.ToString() });
            try { await Db.SaveChangesAsync(token); }
            catch (DbUpdateConcurrencyException) { return Result.Failure<FeedbackRequestDto>(PerformanceErrors.Changed()); }
        }
        return await ProjectAsync(request.Id, command.Actor, token);
    }
}

public sealed class GetFeedbackSummaryHandler(PerformanceDbContext db) : IQueryHandler<GetFeedbackSummaryQuery, Result<FeedbackSummaryDto>>
{
    public const int MaxFrom = 5;
    public const int MaxAskAbout = 3;

    public async Task<Result<FeedbackSummaryDto>> Handle(GetFeedbackSummaryQuery query, CancellationToken token)
    {
        var me = query.Actor.EmployeeId;
        // Received as the Received tab reads it: what the caller may read that was sent to them.
        var asReceiver = FeedbackViewer.For(me, isAdministrator: false, reviewsReports: false, null);
        var received = await FeedbackPolicy.Readable(db.Feedback.AsNoTracking(), asReceiver)
            .Where(f => f.ReceiverEmployeeId == me)
            .OrderByDescending(f => f.SentAt)
            .Select(f => new { f.AuthorEmployeeId, f.AuthorName, f.SubjectKind, f.ObjectiveId, f.ObjectiveTitle, f.CompetencyId })
            .ToListAsync(token);
        var given = me == Guid.Empty ? 0 : await db.Feedback.CountAsync(f => f.AuthorEmployeeId == me, token);
        var toAnswer = me == Guid.Empty ? 0 : await db.FeedbackRequests.CountAsync(r => r.State == FeedbackRequestState.Open
            && r.Invitees.Any(i => i.EmployeeId == me && i.Status == FeedbackInviteeStatus.Waiting), token);

        var authors = received.DistinctBy(f => f.AuthorEmployeeId).ToList();
        var competencyIds = received.Select(f => f.CompetencyId).OfType<Guid>().Distinct().ToList();
        var competencies = competencyIds.Count == 0 ? []
            : await db.Competencies.AsNoTracking().Where(c => competencyIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Name, token);
        var subjects = received.GroupBy(f => (f.SubjectKind, f.ObjectiveId, f.CompetencyId))
            .Select(g => new FeedbackSubjectCountDto(g.Key.SubjectKind, g.Key.ObjectiveId, g.Key.CompetencyId, g.Key.SubjectKind switch
            {
                FeedbackSubjectKind.Objective => g.First().ObjectiveTitle,
                FeedbackSubjectKind.Competency => g.Key.CompetencyId is Guid c ? competencies.GetValueOrDefault(c) : null,
                _ => null,
            }, g.Count()))
            .OrderByDescending(c => c.Count).ThenBy(c => c.Label).ToList();

        IReadOnlyList<FeedbackAskAboutDto> askAbout = [];
        var cycle = await db.Cycles.AsNoTracking().Where(c => c.State == CycleLifecycleState.Active)
            .OrderByDescending(c => c.StartDate).FirstOrDefaultAsync(token);
        if (cycle is not null && me != Guid.Empty)
        {
            var objectives = await db.Objectives.AsNoTracking()
                .Where(o => o.CycleId == cycle.Id && o.AccountablePersonId == me && o.EmployeePlanId != null
                    && o.State != ObjectiveLifecycleState.Archived)
                .Select(o => new { o.Id, o.Title, o.CurrentStatus }).ToListAsync(token);
            var counts = received.Where(f => f.ObjectiveId is not null).GroupBy(f => f.ObjectiveId!.Value).ToDictionary(g => g.Key, g => g.Count());
            askAbout = objectives.Select(o => new FeedbackAskAboutDto(cycle.Id, o.Id, o.Title, o.CurrentStatus, counts.GetValueOrDefault(o.Id)))
                .OrderBy(o => o.Feedback).ThenBy(o => o.Title).Take(MaxAskAbout).ToList();
        }

        return Result.Success(new FeedbackSummaryDto(received.Count, authors.Count,
            authors.Take(MaxFrom).Select(f => new PersonRefDto(f.AuthorEmployeeId, f.AuthorName)).ToList(), subjects, given, toAnswer, askAbout));
    }
}
