using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// The feedback response content — deliberately has NO reviewer FK (D-05 hard separation).
/// Reviewer identity lives in FeedbackIdentityMapping, a strictly separate table.
/// </summary>
public sealed class FeedbackResponseContent : AggregateRoot, ITenantEntity
{
    private readonly List<FeedbackPromptAnswer> _answers = [];

    private FeedbackResponseContent() { }

    public Guid TenantId { get; private set; }
    public uint Version { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid SubjectEmployeeId { get; private set; }
    public CampaignWorkItemType FeedbackType { get; private set; }
    public Guid TemplateSnapshotId { get; private set; }
    public FeedbackResponseStatus Status { get; private set; }
    public DateTime? SubmittedAt { get; private set; }
    public DateTime? LockedAt { get; private set; }
    public bool IsInvalidated { get; private set; }
    public string? InvalidationReason { get; private set; }
    public IReadOnlyCollection<FeedbackPromptAnswer> Answers => _answers.AsReadOnly();

    public static FeedbackResponseContent Create(
        Guid tenantId,
        Guid cycleId,
        Guid subjectEmployeeId,
        CampaignWorkItemType feedbackType,
        Guid templateSnapshotId,
        IEnumerable<FeedbackPromptAnswerInput> answers)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (cycleId == Guid.Empty)
            throw new ArgumentException("CycleId cannot be empty.", nameof(cycleId));
        if (subjectEmployeeId == Guid.Empty)
            throw new ArgumentException("SubjectEmployeeId cannot be empty.", nameof(subjectEmployeeId));
        if (templateSnapshotId == Guid.Empty)
            throw new ArgumentException("TemplateSnapshotId cannot be empty.", nameof(templateSnapshotId));
        if (!Enum.IsDefined(feedbackType))
            throw new ArgumentOutOfRangeException(nameof(feedbackType));

        var answerList = answers?.ToList() ?? throw new ArgumentNullException(nameof(answers));

        var content = new FeedbackResponseContent
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            SubjectEmployeeId = subjectEmployeeId,
            FeedbackType = feedbackType,
            TemplateSnapshotId = templateSnapshotId,
            Status = FeedbackResponseStatus.Draft,
            Version = 1
        };
        content._answers.AddRange(answerList.Select(a => FeedbackPromptAnswer.Create(
            tenantId, content.Id, a.PromptSnapshotId, a.PromptText, a.PromptVersion, a.AnswerText, a.IsRequired)));
        return content;
    }

    /// <summary>
    /// Transition from Draft to Submitted. Enforces D-16: required prompts must be filled.
    /// </summary>
    public void Submit(DateTime occurredAt)
    {
        if (Status != FeedbackResponseStatus.Draft)
            throw new DomainRuleViolationException("Only a draft response can be submitted.");
        Status = FeedbackResponseStatus.Submitted;
        SubmittedAt = NormalizeUtc(occurredAt);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Transition from Submitted back to Draft (D-15: soft withdrawal, not deletion).
    /// </summary>
    public void Withdraw(DateTime occurredAt)
    {
        if (Status != FeedbackResponseStatus.Submitted)
            throw new DomainRuleViolationException("Only a submitted response can be withdrawn.");
        Status = FeedbackResponseStatus.Draft;
        SubmittedAt = null;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Transition from Submitted to Locked (window close or campaign finalization).
    /// </summary>
    public void Lock(DateTime occurredAt)
    {
        if (Status != FeedbackResponseStatus.Submitted)
            throw new DomainRuleViolationException("Only a submitted response can be locked.");
        Status = FeedbackResponseStatus.Locked;
        LockedAt = NormalizeUtc(occurredAt);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Administrative invalidation (D-17): mandatory reason, content preserved for audit.
    /// </summary>
    public void Invalidate(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Invalidation reason is required.", nameof(reason));
        if (IsInvalidated)
            throw new DomainRuleViolationException("Response is already invalidated.");
        IsInvalidated = true;
        InvalidationReason = reason.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    private static DateTime NormalizeUtc(DateTime value)
    {
        if (value == default)
            throw new ArgumentException("A valid timestamp is required.", nameof(value));
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}

public sealed record FeedbackPromptAnswerInput(
    Guid PromptSnapshotId,
    string PromptText,
    int PromptVersion,
    string AnswerText,
    bool IsRequired);
