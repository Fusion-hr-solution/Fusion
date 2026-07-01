using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>A submitted formal assessment. A finalized manager assessment is never overwritten.</summary>
public sealed class PerformanceReview : AggregateRoot, ITenantEntity
{
    private readonly List<PerformanceReviewCriterionResponse> _criteria = [];
    private PerformanceReview() { }

    public Guid TenantId { get; private set; }
    public uint Version { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid WorkItemId { get; private set; }
    public Guid SubjectEmployeeId { get; private set; }
    public Guid ReviewerEmployeeId { get; private set; }
    public FormalReviewKind Kind { get; private set; }
    public Guid DefinitionSnapshotId { get; private set; }
    public FormalReviewStatus Status { get; private set; }
    public string? Narrative { get; private set; }
    public string? EvidenceReference { get; private set; }
    public DateTime? SubmittedAt { get; private set; }
    public DateTime? FinalizedAt { get; private set; }
    public Guid? CorrectionWorkItemId { get; private set; }
    public DateTime? CorrectionRequestedAt { get; private set; }
    public string? CorrectionReason { get; private set; }
    public bool IsLocked => Status == FormalReviewStatus.Finalized;
    public IReadOnlyCollection<PerformanceReviewCriterionResponse> Criteria => _criteria.AsReadOnly();

    public static PerformanceReview Create(Guid tenantId, Guid cycleId, Guid workItemId, Guid subjectEmployeeId,
        Guid reviewerEmployeeId, FormalReviewKind kind, Guid definitionSnapshotId)
    {
        if (tenantId == Guid.Empty || cycleId == Guid.Empty || workItemId == Guid.Empty || subjectEmployeeId == Guid.Empty || reviewerEmployeeId == Guid.Empty || definitionSnapshotId == Guid.Empty)
            throw new ArgumentException("Tenant, campaign, work item, people, and definition are required.");
        if (!Enum.IsDefined(kind)) throw new ArgumentOutOfRangeException(nameof(kind));
        if (kind == FormalReviewKind.Self && subjectEmployeeId != reviewerEmployeeId)
            throw new DomainRuleViolationException("A self review must be authored by its subject.");
        if (kind == FormalReviewKind.Manager && subjectEmployeeId == reviewerEmployeeId)
            throw new DomainRuleViolationException("A manager review cannot be self-authored.");

        return new PerformanceReview
        {
            Id = Guid.NewGuid(), TenantId = tenantId, CycleId = cycleId, WorkItemId = workItemId,
            SubjectEmployeeId = subjectEmployeeId, ReviewerEmployeeId = reviewerEmployeeId, Kind = kind,
            DefinitionSnapshotId = definitionSnapshotId, Status = FormalReviewStatus.Draft
        };
    }

    public void Submit(IEnumerable<ReviewCriterionResponse> criteria, string? narrative, string? evidenceReference, DateTime occurredAt)
    {
        if (IsLocked) throw new DomainRuleViolationException("A finalized review cannot be changed.");
        if (Status != FormalReviewStatus.Draft) throw new DomainRuleViolationException("A review can only be submitted once.");
        var values = criteria?.ToList() ?? throw new ArgumentNullException(nameof(criteria));
        if (values.Count == 0 || values.Any(item => item.CriterionSnapshotId == Guid.Empty || item.Rating <= 0) ||
            values.Select(item => item.CriterionSnapshotId).Distinct().Count() != values.Count)
            throw new DomainRuleViolationException("A review requires one positive rating for each criterion.");

        foreach (var value in values)
        {
            var response = PerformanceReviewCriterionResponse.Create(value);
            response.SetOwner(TenantId, Id);
            _criteria.Add(response);
        }
        Narrative = Optional(narrative, 4000, nameof(narrative));
        EvidenceReference = Optional(evidenceReference, 2000, nameof(evidenceReference));
        Status = FormalReviewStatus.Submitted;
        SubmittedAt = NormalizeUtc(occurredAt);
        UpdatedAt = DateTime.UtcNow;
    }

    public void FinalizeOutcome(DateTime occurredAt)
    {
        if (Kind != FormalReviewKind.Manager)
            throw new DomainRuleViolationException("Only the manager assessment can become the accountable final outcome.");
        if (Status != FormalReviewStatus.Submitted)
            throw new DomainRuleViolationException("Only a submitted manager assessment can be finalized.");
        Status = FormalReviewStatus.Finalized;
        FinalizedAt = NormalizeUtc(occurredAt);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Creates correction work without reopening or mutating the original outcome.</summary>
    public CampaignWorkItem RequestCorrection(DateTime occurredAt, string reason, DateTime dueAt)
    {
        if (!IsLocked) throw new DomainRuleViolationException("Only a finalized manager outcome can be corrected.");
        if (CorrectionWorkItemId.HasValue) throw new DomainRuleViolationException("A correction is already in progress for this final outcome.");
        CorrectionReason = Required(reason, 1000, nameof(reason));
        CorrectionRequestedAt = NormalizeUtc(occurredAt);
        var workItem = CampaignWorkItem.Create(TenantId, CycleId, SubjectEmployeeId, ReviewerEmployeeId,
            CampaignWorkItemType.Correction, dueAt);
        CorrectionWorkItemId = workItem.Id;
        UpdatedAt = DateTime.UtcNow;
        return workItem;
    }

    private static string? Optional(string? value, int maximum, string parameterName)
        => string.IsNullOrWhiteSpace(value) ? null : Required(value, maximum, parameterName);

    private static string Required(string value, int maximum, string parameterName)
    {
        var normalized = value.Trim();
        if (normalized.Length == 0 || normalized.Length > maximum)
            throw new ArgumentException($"Value must be between 1 and {maximum} characters.", parameterName);
        return normalized;
    }

    private static DateTime NormalizeUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };
}

public sealed record ReviewCriterionResponse(Guid CriterionSnapshotId, int Rating, string? Comment);
