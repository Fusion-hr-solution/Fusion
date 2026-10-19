using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Conversations;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Reviews;

public sealed record NominatePeersRequest([property: System.Text.Json.Serialization.JsonRequired] uint ExpectedVersion, IReadOnlyList<Guid> EmployeeIds);
public sealed record PeerAnswersRequest(IReadOnlyList<Models.ReviewAnswerInput>? Answers);
public sealed record DeclinePeerRequestRequest(string? Note);

public sealed record NominatePeersCommand(Guid ReviewId, Guid ActorEmployeeId, NominatePeersRequest Request) : ICommand<Result<ReviewPeersDto>>;
public sealed record ApprovePeerListCommand(Guid ReviewId, Guid ActorEmployeeId, bool ReviewsReports, NominatePeersRequest Request) : ICommand<Result<ReviewPeersDto>>;
public sealed record GetPeerSuggestionsQuery(Guid ReviewId, Guid ActorEmployeeId, bool ReviewsReports) : IQuery<Result<IReadOnlyList<PeerSuggestionDto>>>;
public sealed record GetPeerRequestQuery(Guid RequestId, Guid ActorEmployeeId) : IQuery<Result<PeerRequestDto>>;
public sealed record SavePeerAnswersCommand(Guid RequestId, Guid ActorEmployeeId, PeerAnswersRequest Request) : ICommand<Result<PeerRequestDto>>;
public sealed record SendPeerAnswersCommand(Guid RequestId, Guid ActorEmployeeId, PeerAnswersRequest Request) : ICommand<Result<PeerRequestDto>>;
public sealed record DeclinePeerRequestCommand(Guid RequestId, Guid ActorEmployeeId, DeclinePeerRequestRequest Request) : ICommand<Result<PeerRequestDto>>;

/// <summary>A colleague worth asking, with the facts that suggest them (D4).</summary>
public sealed record PeerSuggestionDto(Guid EmployeeId, string DisplayName, string? JobTitle, string? OrgUnitName,
    bool SharedObjective, int FeedbackExchanged, int PraiseExchanged);

/// <summary>
/// What a peer sees (board 11): whose review, the round's peer questions with their own answers, the due date.
/// Never the review's assessments, ratings, other peers or who else was asked.
/// </summary>
public sealed record PeerRequestDto(Guid Id, Guid SubjectEmployeeId, string SubjectDisplayName, string ReviewRoundName, DateOnly? DueDate,
    int DaysLate, PeerRequestState State, IReadOnlyList<PeerRequestQuestionDto> Questions, string? DeclineNote, DateTime? RespondedAt,
    bool CanAnswer, uint Version);
public sealed record PeerRequestQuestionDto(Guid QuestionId, int SortOrder, string Text, string? Answer);

/// <summary>Only the request's peer reads and acts on it; to anyone else it doesn't exist (D10).</summary>
public static class PeerRequestPolicy
{
    public static bool CanAct(PeerRequest request, Guid actorEmployeeId)
        => actorEmployeeId != Guid.Empty && request.PeerEmployeeId == actorEmployeeId;
}

internal static class PeerInput
{
    public static Error NotFound(Guid id) => PerformanceErrors.NotFound("PeerRequest", id);

    /// <summary>Active colleagues of this tenant, by id, from Core: the people directory's truth.</summary>
    public static async Task<Result<IReadOnlyList<(Guid EmployeeId, string DisplayName)>>> ResolvePeersAsync(ICoreWorkforceClient workforce,
        IReadOnlyList<Guid> ids, CancellationToken token)
    {
        if (ids.Count == 0) return Result.Success<IReadOnlyList<(Guid, string)>>([]);
        IReadOnlyList<WorkforceSnapshot> people;
        try { people = await workforce.ResolveAsync(DateTime.UtcNow, ids.Distinct().ToArray(), token); }
        catch (HttpRequestException) { return Result.Failure<IReadOnlyList<(Guid, string)>>(PerformanceErrors.CoreUnavailable()); }
        var byId = people.Where(p => p.IsActive).ToDictionary(p => p.EmployeeId);
        if (ids.Any(id => !byId.ContainsKey(id)))
            return Result.Failure<IReadOnlyList<(Guid, string)>>(PerformanceErrors.Validation(PerformanceErrors.Codes.PeerInputInvalid,
                "Choose colleagues who currently work here."));
        return Result.Success<IReadOnlyList<(Guid, string)>>(ids.Select(id => (id, byId[id].DisplayName)).ToArray());
    }

    public static async Task<ReviewPeersDto> PeersAsync(PerformanceDbContext db, PerformanceReview review, CancellationToken token)
        => (await new GetPerformanceReviewHandler(db).ExtrasAsync(review, token)).Peers!;

    public static async Task<PeerRequestDto> ProjectAsync(PerformanceDbContext db, PeerRequest request, CancellationToken token)
    {
        var round = await db.ReviewRounds.AsNoTracking().SingleAsync(r => r.Id == request.ReviewRoundId, token);
        var questions = await db.ReviewQuestionSnapshots.AsNoTracking()
            .Where(q => q.ReviewRoundId == request.ReviewRoundId && q.Audience == ReviewQuestionAudience.Peer)
            .OrderBy(q => q.SortOrder).ToListAsync(token);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return new PeerRequestDto(request.Id, request.SubjectEmployeeId, request.SubjectDisplayName, round.Name, request.DueDate,
            request.State == PeerRequestState.Open ? ReviewReminderSchedule.DaysLate(request.DueDate, today) : 0, request.State,
            questions.Select(q => new PeerRequestQuestionDto(q.Id, q.SortOrder, q.Text,
                request.Answers.FirstOrDefault(a => a.QuestionSnapshotId == q.Id)?.Text)).ToArray(),
            request.DeclineNote, request.RespondedAt, request.State == PeerRequestState.Open, request.Version);
    }

    public static async Task<IReadOnlyCollection<Guid>> QuestionIdsAsync(PerformanceDbContext db, PeerRequest request, CancellationToken token)
        => await db.ReviewQuestionSnapshots.AsNoTracking()
            .Where(q => q.ReviewRoundId == request.ReviewRoundId && q.Audience == ReviewQuestionAudience.Peer)
            .Select(q => q.Id).ToListAsync(token);

    public static Dictionary<Guid, string?> Answers(PeerAnswersRequest request)
        => (request.Answers ?? []).GroupBy(a => a.QuestionId).ToDictionary(g => g.Key, g => g.Last().Text);
}

/// <summary>The person's list of 1–5 colleagues while self-assessing (D-18); the reviewer is told the first time.</summary>
public sealed class NominatePeersHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, IPerformanceAudit audit,
    IPerformanceNotifications notifications) : ICommandHandler<NominatePeersCommand, Result<ReviewPeersDto>>
{
    public async Task<Result<ReviewPeersDto>> Handle(NominatePeersCommand command, CancellationToken token)
    {
        var review = await db.PerformanceReviews.Include(r => r.PeerNominations).FirstOrDefaultAsync(r => r.Id == command.ReviewId, token);
        if (review is null) return Result.Failure<ReviewPeersDto>(PerformanceErrors.NotFound("PerformanceReview", command.ReviewId));
        if (review.SubjectEmployeeId != command.ActorEmployeeId)
            return Result.Failure<ReviewPeersDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.PeerInputForbidden, "Only the person reviewed nominates their peers."));
        if (VersionGuard.Check(review, command.Request.ExpectedVersion) is { } stale) return Result.Failure<ReviewPeersDto>(stale);
        var resolved = await PeerInput.ResolvePeersAsync(workforce, command.Request.EmployeeIds, token);
        if (resolved.IsFailure) return Result.Failure<ReviewPeersDto>(resolved.Error);
        var before = review.PeerNominations.ToList();
        bool first;
        try { first = review.NominatePeers(command.ActorEmployeeId, resolved.Value, DateTime.UtcNow); }
        catch (ArgumentException ex) { return Result.Failure<ReviewPeersDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.PeerInputInvalid, ex.Message)); }
        catch (InvalidOperationException ex) { return Result.Failure<ReviewPeersDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.PeerInputNotOpen, ex.Message)); }
        db.PeerNominations.RemoveRange(before.Where(item => !review.PeerNominations.Contains(item)));
        db.PeerNominations.AddRange(review.PeerNominations.Where(item => !before.Contains(item)));
        var round = await db.ReviewRounds.AsNoTracking().SingleAsync(r => r.Id == review.ReviewRoundId, token);
        if (first)
        {
            var href = PerformanceNotificationTemplates.PeerListPath(review.Id);
            notifications.EnqueueReviewWork(review, PerformanceNotificationKind.PeersNominated, review.ReviewerEmployeeId, "PerformanceReview",
                review.Id, $"{PerformanceNotificationKind.PeersNominated}:{review.Id:N}:{review.ReviewerEmployeeId:N}",
                new ReviewWorkNotificationPayload(review.CycleId, round.Id, review.Id, round.Name, href, review.SubjectDisplayName, review.SubjectDisplayName),
                PerformanceNotificationTemplates.ForPeersNominated(review.SubjectDisplayName, round.Name, review.Id));
        }
        audit.Record(review.TenantId, "PerformanceReview", review.Id, review.CycleId, PerformanceAuditActions.ReviewPeersNominated,
            new { peers = resolved.Value.Select(p => p.EmployeeId).ToArray() });
        await db.SaveChangesAsync(token);
        return Result.Success(await PeerInput.PeersAsync(db, review, token));
    }
}

/// <summary>
/// The reviewer approves the list as is or edited (remove, swap, add); each approved colleague gets a peer request with the
/// round's peer due date, and the person and each peer are told (D3).
/// </summary>
public sealed class ApprovePeerListHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, IPerformanceAudit audit,
    IPerformanceNotifications notifications) : ICommandHandler<ApprovePeerListCommand, Result<ReviewPeersDto>>
{
    public async Task<Result<ReviewPeersDto>> Handle(ApprovePeerListCommand command, CancellationToken token)
    {
        var review = await db.PerformanceReviews.Include(r => r.PeerNominations).FirstOrDefaultAsync(r => r.Id == command.ReviewId, token);
        if (review is null) return Result.Failure<ReviewPeersDto>(PerformanceErrors.NotFound("PerformanceReview", command.ReviewId));
        if (!command.ReviewsReports || review.ReviewerEmployeeId != command.ActorEmployeeId)
            return Result.Failure<ReviewPeersDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.PeerInputForbidden, "Only the reviewer approves the peer list."));
        if (VersionGuard.Check(review, command.Request.ExpectedVersion) is { } stale) return Result.Failure<ReviewPeersDto>(stale);
        var resolved = await PeerInput.ResolvePeersAsync(workforce, command.Request.EmployeeIds, token);
        if (resolved.IsFailure) return Result.Failure<ReviewPeersDto>(resolved.Error);
        var before = review.PeerNominations.ToList();
        var now = DateTime.UtcNow;
        PeerListDecision decision;
        try { decision = review.ApprovePeerList(command.ActorEmployeeId, resolved.Value, now); }
        catch (ArgumentException ex) { return Result.Failure<ReviewPeersDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.PeerInputInvalid, ex.Message)); }
        catch (InvalidOperationException ex) { return Result.Failure<ReviewPeersDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.PeerInputNotOpen, ex.Message)); }
        db.PeerNominations.RemoveRange(before.Where(item => !review.PeerNominations.Contains(item)));
        db.PeerNominations.AddRange(review.PeerNominations.Where(item => !before.Contains(item)));

        var round = await db.ReviewRounds.AsNoTracking().SingleAsync(r => r.Id == review.ReviewRoundId, token);
        var requests = resolved.Value.Select(peer => PeerRequest.Create(review, peer.EmployeeId, peer.DisplayName, round.PeerInputDueDate, now)).ToList();
        db.PeerRequests.AddRange(requests);
        var reviewHref = PerformanceNotificationTemplates.ReviewPath(review.Id);
        notifications.EnqueueReviewWork(review, PerformanceNotificationKind.PeerListApproved, review.SubjectEmployeeId, "PerformanceReview", review.Id,
            $"{PerformanceNotificationKind.PeerListApproved}:{review.Id:N}:{review.SubjectEmployeeId:N}",
            new ReviewWorkNotificationPayload(review.CycleId, round.Id, review.Id, round.Name, reviewHref, review.ReviewerDisplayName, review.SubjectDisplayName),
            PerformanceNotificationTemplates.ForPeerListApproved(review.ReviewerDisplayName, round.Name, review.Id));
        foreach (var request in requests)
        {
            var href = PerformanceNotificationTemplates.PeerRequestPath(request.Id);
            notifications.EnqueueReviewWork(review, PerformanceNotificationKind.PeerInputRequested, request.PeerEmployeeId, "PeerRequest", request.Id,
                $"{PerformanceNotificationKind.PeerInputRequested}:{request.Id:N}:{request.PeerEmployeeId:N}",
                new ReviewWorkNotificationPayload(review.CycleId, round.Id, review.Id, round.Name, href, null, review.SubjectDisplayName,
                    "peer input", request.DueDate),
                PerformanceNotificationTemplates.ForPeerInputRequested(review.SubjectDisplayName, round.Name, request.DueDate, request.Id));
        }
        audit.Record(review.TenantId, "PerformanceReview", review.Id, review.CycleId, PerformanceAuditActions.ReviewPeerListApproved,
            new { approved = resolved.Value.Select(p => p.EmployeeId).ToArray(), removed = decision.Removed, added = decision.Added });
        await db.SaveChangesAsync(token);
        return Result.Success(await PeerInput.PeersAsync(db, review, token));
    }
}

/// <summary>
/// Colleagues the reviewer might ask (D4): ranked by feedback and praise exchanged with the person in the review period and by
/// approved objectives aligned to the same parent. Top three; never the person, the reviewer, someone already listed or inactive.
/// </summary>
public sealed class GetPeerSuggestionsHandler(PerformanceDbContext db, ICoreWorkforceClient workforce)
    : IQueryHandler<GetPeerSuggestionsQuery, Result<IReadOnlyList<PeerSuggestionDto>>>
{
    public async Task<Result<IReadOnlyList<PeerSuggestionDto>>> Handle(GetPeerSuggestionsQuery query, CancellationToken token)
    {
        var review = await db.PerformanceReviews.AsNoTracking().FirstOrDefaultAsync(r => r.Id == query.ReviewId, token);
        if (review is null) return Result.Failure<IReadOnlyList<PeerSuggestionDto>>(PerformanceErrors.NotFound("PerformanceReview", query.ReviewId));
        if (!query.ReviewsReports || review.ReviewerEmployeeId != query.ActorEmployeeId)
            return Result.Failure<IReadOnlyList<PeerSuggestionDto>>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.PeerInputForbidden,
                "Only the reviewer sees peer suggestions."));
        var round = await db.ReviewRounds.AsNoTracking().SingleAsync(r => r.Id == review.ReviewRoundId, token);
        var periodFrom = round.PeriodStart.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var periodTo = round.PeriodEnd.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var subject = review.SubjectEmployeeId;

        var feedback = await db.Feedback.AsNoTracking()
            .Where(f => (f.ReceiverEmployeeId == subject || f.AuthorEmployeeId == subject) && f.SentAt >= periodFrom && f.SentAt < periodTo
                // Only feedback the reviewer may see counts: manager-only feedback addressed to someone else stays out.
                && (f.Visibility == FeedbackVisibility.Shared || f.AddressedManagerEmployeeId == query.ActorEmployeeId))
            .Select(f => f.ReceiverEmployeeId == subject ? f.AuthorEmployeeId : f.ReceiverEmployeeId).ToListAsync(token);
        var praiseGiven = await (from recipient in db.PraiseRecipients.AsNoTracking()
                                 join praise in db.Praise.AsNoTracking() on recipient.PraiseId equals praise.Id
                                 where praise.AuthorEmployeeId == subject && praise.DeletedAt == null
                                       && praise.GivenAt >= periodFrom && praise.GivenAt < periodTo
                                 select recipient.EmployeeId).ToListAsync(token);
        var praiseReceived = await (from recipient in db.PraiseRecipients.AsNoTracking()
                                    join praise in db.Praise.AsNoTracking() on recipient.PraiseId equals praise.Id
                                    where recipient.EmployeeId == subject && praise.DeletedAt == null
                                          && praise.GivenAt >= periodFrom && praise.GivenAt < periodTo
                                    select praise.AuthorEmployeeId).ToListAsync(token);
        var approved = from objective in db.Objectives.AsNoTracking()
                       join plan in db.EmployeePlans.AsNoTracking() on objective.EmployeePlanId equals plan.Id
                       where plan.CycleId == review.CycleId && plan.State == PlanLifecycleState.Approved
                             && objective.State != ObjectiveLifecycleState.Archived && objective.ParentObjectiveId != null
                       select new { plan.EmployeeId, Parent = objective.ParentObjectiveId!.Value };
        var parents = await approved.Where(o => o.EmployeeId == subject).Select(o => o.Parent).Distinct().ToListAsync(token);
        var sharing = parents.Count == 0 ? [] : await approved.Where(o => o.EmployeeId != subject && parents.Contains(o.Parent))
            .Select(o => o.EmployeeId).Distinct().ToListAsync(token);

        var excluded = (await db.PeerNominations.AsNoTracking().Where(n => n.ReviewId == review.Id).Select(n => n.EmployeeId).ToListAsync(token))
            .Append(subject).Append(review.ReviewerEmployeeId).ToHashSet();
        var candidates = feedback.Concat(praiseGiven).Concat(praiseReceived).Concat(sharing).Where(id => !excluded.Contains(id)).Distinct().ToArray();
        if (candidates.Length == 0) return Result.Success<IReadOnlyList<PeerSuggestionDto>>([]);
        IReadOnlyList<WorkforceSnapshot> people;
        try { people = await workforce.ResolveAsync(DateTime.UtcNow, candidates, token); }
        catch (HttpRequestException) { return Result.Failure<IReadOnlyList<PeerSuggestionDto>>(PerformanceErrors.CoreUnavailable()); }
        return Result.Success<IReadOnlyList<PeerSuggestionDto>>(people.Where(p => p.IsActive)
            .Select(p => new PeerSuggestionDto(p.EmployeeId, p.DisplayName, p.JobTitle, p.OrgUnit?.Name, sharing.Contains(p.EmployeeId),
                feedback.Count(id => id == p.EmployeeId), praiseGiven.Concat(praiseReceived).Count(id => id == p.EmployeeId)))
            .OrderByDescending(s => s.FeedbackExchanged + s.PraiseExchanged + (s.SharedObjective ? 3 : 0))
            .ThenBy(s => s.DisplayName, StringComparer.OrdinalIgnoreCase)
            .Take(3).ToArray());
    }
}

public sealed class GetPeerRequestHandler(PerformanceDbContext db) : IQueryHandler<GetPeerRequestQuery, Result<PeerRequestDto>>
{
    public async Task<Result<PeerRequestDto>> Handle(GetPeerRequestQuery query, CancellationToken token)
    {
        var request = await db.PeerRequests.AsNoTracking().Include(r => r.Answers).FirstOrDefaultAsync(r => r.Id == query.RequestId, token);
        if (request is null || !PeerRequestPolicy.CanAct(request, query.ActorEmployeeId))
            return Result.Failure<PeerRequestDto>(PeerInput.NotFound(query.RequestId));
        return Result.Success(await PeerInput.ProjectAsync(db, request, token));
    }
}

public sealed class SavePeerAnswersHandler(PerformanceDbContext db) : ICommandHandler<SavePeerAnswersCommand, Result<PeerRequestDto>>
{
    public async Task<Result<PeerRequestDto>> Handle(SavePeerAnswersCommand command, CancellationToken token)
    {
        var request = await db.PeerRequests.Include(r => r.Answers).FirstOrDefaultAsync(r => r.Id == command.RequestId, token);
        if (request is null || !PeerRequestPolicy.CanAct(request, command.ActorEmployeeId))
            return Result.Failure<PeerRequestDto>(PeerInput.NotFound(command.RequestId));
        var before = request.Answers.ToList();
        try { request.SaveDraft(command.ActorEmployeeId, PeerInput.Answers(command.Request), await PeerInput.QuestionIdsAsync(db, request, token)); }
        catch (PeerRequestClosedException ex) { return Result.Failure<PeerRequestDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.PeerRequestClosed, ex.Message)); }
        catch (ArgumentException ex) { return Result.Failure<PeerRequestDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.PeerRequestInvalid, ex.Message)); }
        catch (InvalidOperationException ex) { return Result.Failure<PeerRequestDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.PeerRequestAnswered, ex.Message)); }
        PeerAnswerRows.Sync(db, before, request);
        await db.SaveChangesAsync(token);
        return Result.Success(await PeerInput.ProjectAsync(db, request, token));
    }
}

public sealed class SendPeerAnswersHandler(PerformanceDbContext db, IPerformanceAudit audit) : ICommandHandler<SendPeerAnswersCommand, Result<PeerRequestDto>>
{
    public async Task<Result<PeerRequestDto>> Handle(SendPeerAnswersCommand command, CancellationToken token)
    {
        var request = await db.PeerRequests.Include(r => r.Answers).FirstOrDefaultAsync(r => r.Id == command.RequestId, token);
        if (request is null || !PeerRequestPolicy.CanAct(request, command.ActorEmployeeId))
            return Result.Failure<PeerRequestDto>(PeerInput.NotFound(command.RequestId));
        var before = request.Answers.ToList();
        bool changed;
        try { changed = request.Send(command.ActorEmployeeId, PeerInput.Answers(command.Request), await PeerInput.QuestionIdsAsync(db, request, token), DateTime.UtcNow); }
        catch (PeerAnswersMissingException ex)
        {
            return Result.Failure<PeerRequestDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.PeerRequestInvalid, ex.Message,
                new { questions = ex.QuestionIds }));
        }
        catch (PeerRequestClosedException ex) { return Result.Failure<PeerRequestDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.PeerRequestClosed, ex.Message)); }
        catch (ArgumentException ex) { return Result.Failure<PeerRequestDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.PeerRequestInvalid, ex.Message)); }
        catch (InvalidOperationException ex) { return Result.Failure<PeerRequestDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.PeerRequestAnswered, ex.Message)); }
        if (changed)
        {
            PeerAnswerRows.Sync(db, before, request);
            audit.Record(request.TenantId, "PeerRequest", request.Id, request.CycleId, PerformanceAuditActions.ReviewPeerAnswered,
                new { reviewId = request.ReviewId, answeredAt = request.RespondedAt });
            await db.SaveChangesAsync(token);
        }
        return Result.Success(await PeerInput.ProjectAsync(db, request, token));
    }
}

public sealed class DeclinePeerRequestHandler(PerformanceDbContext db, IPerformanceAudit audit, IPerformanceNotifications notifications)
    : ICommandHandler<DeclinePeerRequestCommand, Result<PeerRequestDto>>
{
    public async Task<Result<PeerRequestDto>> Handle(DeclinePeerRequestCommand command, CancellationToken token)
    {
        var request = await db.PeerRequests.Include(r => r.Answers).FirstOrDefaultAsync(r => r.Id == command.RequestId, token);
        if (request is null || !PeerRequestPolicy.CanAct(request, command.ActorEmployeeId))
            return Result.Failure<PeerRequestDto>(PeerInput.NotFound(command.RequestId));
        var before = request.Answers.ToList();
        bool changed;
        try { changed = request.Decline(command.ActorEmployeeId, command.Request.Note, DateTime.UtcNow); }
        catch (PeerRequestClosedException ex) { return Result.Failure<PeerRequestDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.PeerRequestClosed, ex.Message)); }
        catch (ArgumentException ex) { return Result.Failure<PeerRequestDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.PeerRequestInvalid, ex.Message)); }
        catch (InvalidOperationException ex) { return Result.Failure<PeerRequestDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.PeerRequestAnswered, ex.Message)); }
        if (changed)
        {
            PeerAnswerRows.Sync(db, before, request);
            var review = await db.PerformanceReviews.AsNoTracking().SingleAsync(r => r.Id == request.ReviewId, token);
            var round = await db.ReviewRounds.AsNoTracking().SingleAsync(r => r.Id == request.ReviewRoundId, token);
            var href = PerformanceNotificationTemplates.ReviewPath(review.Id);
            notifications.EnqueueReviewWork(review, PerformanceNotificationKind.PeerDeclined, review.ReviewerEmployeeId, "PeerRequest", request.Id,
                $"{PerformanceNotificationKind.PeerDeclined}:{request.Id:N}:{review.ReviewerEmployeeId:N}",
                new ReviewWorkNotificationPayload(review.CycleId, round.Id, review.Id, round.Name, href, request.PeerDisplayName, review.SubjectDisplayName),
                PerformanceNotificationTemplates.ForPeerDeclined(request.PeerDisplayName, review.SubjectDisplayName, review.Id));
            audit.Record(request.TenantId, "PeerRequest", request.Id, request.CycleId, PerformanceAuditActions.ReviewPeerDeclined,
                new { reviewId = request.ReviewId, hasNote = request.DeclineNote is not null });
            await db.SaveChangesAsync(token);
        }
        return Result.Success(await PeerInput.ProjectAsync(db, request, token));
    }
}

/// <summary>Answer rows follow the request's list: new ones are added, cleared ones deleted.</summary>
internal static class PeerAnswerRows
{
    public static void Sync(PerformanceDbContext db, IReadOnlyList<PeerAnswer> before, PeerRequest request)
    {
        db.PeerAnswers.RemoveRange(before.Where(answer => !request.Answers.Contains(answer)));
        db.PeerAnswers.AddRange(request.Answers.Where(answer => !before.Contains(answer)));
    }
}
