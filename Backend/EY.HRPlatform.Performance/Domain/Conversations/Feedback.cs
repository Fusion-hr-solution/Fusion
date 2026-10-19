using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Conversations;

public enum FeedbackVisibility { Shared = 0, ManagerOnly = 1 }
public enum FeedbackSubjectKind { None = 0, Objective = 1, Competency = 2 }
public enum FeedbackRequestState { Open = 0, Closed = 1 }
public enum FeedbackRequestCloseReason { AllResponded = 0, ClosedByRequester = 1 }
public enum FeedbackInviteeStatus { Waiting = 0, Answered = 1, Declined = 2 }

/// <summary>What feedback or a request is about: nothing, one objective (title frozen at sending) or one competency.</summary>
public sealed record FeedbackSubject(FeedbackSubjectKind Kind, Guid? CycleId = null, Guid? ObjectiveId = null, string? ObjectiveTitle = null,
    Guid? CompetencyId = null)
{
    public static readonly FeedbackSubject None = new(FeedbackSubjectKind.None);

    internal void Validate()
    {
        switch (Kind)
        {
            case FeedbackSubjectKind.None when CycleId is null && ObjectiveId is null && CompetencyId is null:
            case FeedbackSubjectKind.Objective when CycleId is Guid c && c != Guid.Empty && ObjectiveId is Guid o && o != Guid.Empty
                && !string.IsNullOrWhiteSpace(ObjectiveTitle) && CompetencyId is null:
            case FeedbackSubjectKind.Competency when CompetencyId is Guid k && k != Guid.Empty && ObjectiveId is null:
                return;
            default:
                throw new ArgumentException("Choose one objective, one competency, or nothing.", nameof(Kind));
        }
    }
}

/// <summary>
/// Feedback from one colleague to another (D-13). Fixed once sent: there is no way to change or delete it.
/// The id comes from the client, so a retried send finds the original. Manager-only feedback is addressed to
/// the receiver's manager at the time of sending and only that manager and the author ever read it.
/// Names and an objective's title are frozen as they were when it was sent.
/// </summary>
public sealed class Feedback : PerformanceAggregate
{
    public const int MaxMessageLength = 2_000;

    private Feedback() { }

    public Guid AuthorEmployeeId { get; private set; }
    public string AuthorName { get; private set; } = string.Empty;
    public Guid ReceiverEmployeeId { get; private set; }
    public string ReceiverName { get; private set; } = string.Empty;
    public FeedbackVisibility Visibility { get; private set; }
    /// <summary>The receiver's manager when it was sent; required for manager-only feedback.</summary>
    public Guid? AddressedManagerEmployeeId { get; private set; }
    public string? AddressedManagerName { get; private set; }
    public FeedbackSubjectKind SubjectKind { get; private set; }
    public Guid? CycleId { get; private set; }
    public Guid? ObjectiveId { get; private set; }
    public string? ObjectiveTitle { get; private set; }
    public Guid? CompetencyId { get; private set; }
    public string Message { get; private set; } = string.Empty;
    /// <summary>The request this answers, when it was asked for.</summary>
    public Guid? RequestId { get; private set; }
    public DateTime SentAt { get; private set; }

    public FeedbackSubject Subject => new(SubjectKind, CycleId, ObjectiveId, ObjectiveTitle, CompetencyId);

    public static Feedback Give(Guid id, Guid tenantId, Guid authorEmployeeId, string authorName, Guid receiverEmployeeId, string receiverName,
        FeedbackVisibility visibility, Guid? addressedManagerEmployeeId, string? addressedManagerName, FeedbackSubject subject, string message,
        DateTime now, Guid? requestId = null)
    {
        if (id == Guid.Empty) throw new ArgumentException("Feedback needs an id.", nameof(id));
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId is required.", nameof(tenantId));
        if (authorEmployeeId == Guid.Empty || receiverEmployeeId == Guid.Empty)
            throw new ArgumentException("Feedback has an author and a receiver.", nameof(receiverEmployeeId));
        if (authorEmployeeId == receiverEmployeeId) throw new ArgumentException("Give feedback to someone else.", nameof(receiverEmployeeId));
        if (!Enum.IsDefined(visibility)) throw new ArgumentException("Choose shared or manager only.", nameof(visibility));
        if (visibility == FeedbackVisibility.ManagerOnly)
        {
            if (addressedManagerEmployeeId is not Guid manager || manager == Guid.Empty)
                throw new FeedbackNoManagerException();
            if (manager == authorEmployeeId)
                throw new ArgumentException("As their manager, share it with them instead.", nameof(visibility));
        }
        ArgumentNullException.ThrowIfNull(subject);
        subject.Validate();
        var text = message?.Trim() ?? string.Empty;
        if (text.Length == 0) throw new ArgumentException("Write the feedback.", nameof(message));
        if (text.Length > MaxMessageLength) throw new ArgumentException($"Keep feedback to {MaxMessageLength:N0} characters.", nameof(message));

        return new Feedback
        {
            Id = id,
            TenantId = tenantId,
            AuthorEmployeeId = authorEmployeeId,
            AuthorName = authorName,
            ReceiverEmployeeId = receiverEmployeeId,
            ReceiverName = receiverName,
            Visibility = visibility,
            AddressedManagerEmployeeId = addressedManagerEmployeeId == Guid.Empty ? null : addressedManagerEmployeeId,
            AddressedManagerName = addressedManagerEmployeeId is null ? null : addressedManagerName,
            SubjectKind = subject.Kind,
            CycleId = subject.CycleId,
            ObjectiveId = subject.ObjectiveId,
            ObjectiveTitle = subject.ObjectiveTitle?.Trim(),
            CompetencyId = subject.CompetencyId,
            Message = text,
            RequestId = requestId,
            SentAt = now,
        };
    }
}

/// <summary>Manager-only feedback for someone Core HR reports no manager for.</summary>
public sealed class FeedbackNoManagerException() : Exception("They have no manager to address this to. Share it instead.");

/// <summary>
/// A question put to 1–5 colleagues with a due date (D-13). Each invitee answers or declines once; an answer is
/// shared feedback to the requester. The request closes when everyone has responded, or when the requester closes it.
/// The due date is advisory: late answers count.
/// </summary>
public sealed class FeedbackRequest : PerformanceAggregate
{
    public const int MaxInvitees = 5;
    public const int MaxQuestionLength = 300;
    public const int MaxDeclineReasonLength = 300;

    private readonly List<FeedbackRequestInvitee> _invitees = [];

    private FeedbackRequest() { }

    public Guid RequesterEmployeeId { get; private set; }
    public string RequesterName { get; private set; } = string.Empty;
    public string Question { get; private set; } = string.Empty;
    public FeedbackSubjectKind SubjectKind { get; private set; }
    public Guid? CycleId { get; private set; }
    public Guid? ObjectiveId { get; private set; }
    public string? ObjectiveTitle { get; private set; }
    public Guid? CompetencyId { get; private set; }
    public DateOnly DueDate { get; private set; }
    public FeedbackRequestState State { get; private set; }
    public DateTime RequestedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }
    public FeedbackRequestCloseReason? CloseReason { get; private set; }

    public IReadOnlyList<FeedbackRequestInvitee> Invitees => _invitees;
    public FeedbackSubject Subject => new(SubjectKind, CycleId, ObjectiveId, ObjectiveTitle, CompetencyId);

    public static FeedbackRequest Ask(Guid id, Guid tenantId, Guid requesterEmployeeId, string requesterName, string question,
        FeedbackSubject subject, DateOnly dueDate, IReadOnlyList<(Guid EmployeeId, string Name)> invitees, DateOnly today, DateTime now)
    {
        if (id == Guid.Empty) throw new ArgumentException("A request needs an id.", nameof(id));
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId is required.", nameof(tenantId));
        if (requesterEmployeeId == Guid.Empty) throw new ArgumentException("A request has a requester.", nameof(requesterEmployeeId));
        var text = question?.Trim() ?? string.Empty;
        if (text.Length == 0) throw new ArgumentException("Write what you'd like feedback on.", nameof(question));
        if (text.Length > MaxQuestionLength) throw new ArgumentException($"Keep the question to {MaxQuestionLength} characters.", nameof(question));
        ArgumentNullException.ThrowIfNull(subject);
        subject.Validate();
        if (dueDate < today) throw new ArgumentException("Choose a due date from today onwards.", nameof(dueDate));
        var people = (invitees ?? []).Where(i => i.EmployeeId != Guid.Empty).DistinctBy(i => i.EmployeeId).ToList();
        if (people.Count == 0 || people.Count > MaxInvitees) throw new ArgumentException($"Ask 1 to {MaxInvitees} colleagues.", nameof(invitees));
        if (people.Any(p => p.EmployeeId == requesterEmployeeId)) throw new ArgumentException("Ask colleagues other than yourself.", nameof(invitees));

        var request = new FeedbackRequest
        {
            Id = id,
            TenantId = tenantId,
            RequesterEmployeeId = requesterEmployeeId,
            RequesterName = requesterName,
            Question = text,
            SubjectKind = subject.Kind,
            CycleId = subject.CycleId,
            ObjectiveId = subject.ObjectiveId,
            ObjectiveTitle = subject.ObjectiveTitle?.Trim(),
            CompetencyId = subject.CompetencyId,
            DueDate = dueDate,
            State = FeedbackRequestState.Open,
            RequestedAt = now,
        };
        foreach (var person in people) request._invitees.Add(FeedbackRequestInvitee.Create(tenantId, request.Id, person.EmployeeId, person.Name));
        return request;
    }

    public FeedbackRequestInvitee? InviteeFor(Guid employeeId) => _invitees.FirstOrDefault(i => i.EmployeeId == employeeId);

    /// <summary>Records an answer. False when this invitee already responded (the retry returns their original response).</summary>
    public bool RecordAnswer(Guid inviteeEmployeeId, Guid feedbackId, DateTime now)
    {
        var invitee = Respondent(inviteeEmployeeId, out var responded);
        if (responded) return false;
        invitee.Answer(feedbackId, now);
        CloseIfComplete(now);
        MarkUpdated();
        return true;
    }

    public bool Decline(Guid inviteeEmployeeId, string? reason, DateTime now)
    {
        var invitee = Respondent(inviteeEmployeeId, out var responded);
        if (responded) return false;
        var text = reason?.Trim();
        if (text is { Length: > MaxDeclineReasonLength })
            throw new ArgumentException($"Keep the reason to {MaxDeclineReasonLength} characters.", nameof(reason));
        invitee.Decline(string.IsNullOrEmpty(text) ? null : text, now);
        CloseIfComplete(now);
        MarkUpdated();
        return true;
    }

    /// <summary>The requester closes the request early. False when it's already closed.</summary>
    public bool Close(Guid actorEmployeeId, DateTime now)
    {
        if (actorEmployeeId != RequesterEmployeeId) throw new UnauthorizedAccessException("Only the person who asked closes the request.");
        if (State == FeedbackRequestState.Closed) return false;
        State = FeedbackRequestState.Closed;
        ClosedAt = now;
        CloseReason = FeedbackRequestCloseReason.ClosedByRequester;
        MarkUpdated();
        return true;
    }

    private FeedbackRequestInvitee Respondent(Guid inviteeEmployeeId, out bool responded)
    {
        var invitee = InviteeFor(inviteeEmployeeId) ?? throw new KeyNotFoundException("You weren't asked for this feedback.");
        responded = invitee.Status != FeedbackInviteeStatus.Waiting;
        if (!responded && State == FeedbackRequestState.Closed) throw new InvalidOperationException("This request is closed.");
        return invitee;
    }

    private void CloseIfComplete(DateTime now)
    {
        if (_invitees.Any(i => i.Status == FeedbackInviteeStatus.Waiting)) return;
        State = FeedbackRequestState.Closed;
        ClosedAt = now;
        CloseReason = FeedbackRequestCloseReason.AllResponded;
    }
}

public sealed class FeedbackRequestInvitee : PerformanceChildEntity
{
    private FeedbackRequestInvitee() { }

    public Guid RequestId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public FeedbackInviteeStatus Status { get; private set; }
    public DateTime? RespondedAt { get; private set; }
    public string? DeclineReason { get; private set; }
    public Guid? FeedbackId { get; private set; }

    internal static FeedbackRequestInvitee Create(Guid tenantId, Guid requestId, Guid employeeId, string name)
        => new() { TenantId = tenantId, RequestId = requestId, EmployeeId = employeeId, Name = name, Status = FeedbackInviteeStatus.Waiting };

    internal void Answer(Guid feedbackId, DateTime now)
    {
        Status = FeedbackInviteeStatus.Answered;
        FeedbackId = feedbackId;
        RespondedAt = now;
        MarkUpdated();
    }

    internal void Decline(string? reason, DateTime now)
    {
        Status = FeedbackInviteeStatus.Declined;
        DeclineReason = reason;
        RespondedAt = now;
        MarkUpdated();
    }
}
