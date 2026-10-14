using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Domain.Population;

namespace EY.HRPlatform.Performance.Domain.Reviews;

/// <summary>One Cycle participant's inclusion and reviewer snapshot in a Draft round.</summary>
public sealed class ReviewRoundSubject : PerformanceChildEntity
{
    private ReviewRoundSubject() { }

    public Guid ReviewRoundId { get; private set; }
    public Guid ParticipantId { get; private set; }
    public Guid SubjectEmployeeId { get; private set; }
    public string SubjectDisplayName { get; private set; } = string.Empty;
    public Guid? ReviewerEmployeeId { get; private set; }
    public string? ReviewerDisplayName { get; private set; }
    public ReviewerBasis ReviewerBasis { get; private set; }
    public bool IsExcluded { get; private set; }
    public string? ExclusionReason { get; private set; }

    public static ReviewRoundSubject Create(Guid tenantId, Guid roundId, Participant participant,
        Guid? reviewerId, string? reviewerName)
        => new()
        {
            TenantId = tenantId,
            ReviewRoundId = roundId,
            ParticipantId = participant.Id,
            SubjectEmployeeId = participant.EmployeeId,
            SubjectDisplayName = participant.DisplayName,
            ReviewerEmployeeId = reviewerId == Guid.Empty ? null : reviewerId,
            ReviewerDisplayName = Normalize(reviewerName),
            ReviewerBasis = participant.ReviewerBasis,
        };

    public void Exclude(ReviewRound round, string reason)
    {
        RequireDraft(round);
        var value = Normalize(reason);
        if (value is null) throw new ArgumentException("An exclusion reason is required.", nameof(reason));
        if (value.Length > 1000) throw new ArgumentException("The exclusion reason must be 1000 characters or fewer.", nameof(reason));
        if (IsExcluded && ExclusionReason == value) return;
        IsExcluded = true;
        ExclusionReason = value;
        MarkUpdated();
    }

    public void Include(ReviewRound round)
    {
        RequireDraft(round);
        if (!IsExcluded) return;
        IsExcluded = false;
        ExclusionReason = null;
        MarkUpdated();
    }

    public void AssignReviewer(ReviewRound round, Guid reviewerId, string reviewerName)
    {
        RequireDraft(round);
        if (reviewerId == Guid.Empty) throw new ArgumentException("A reviewer is required.", nameof(reviewerId));
        if (reviewerId == SubjectEmployeeId) throw new ArgumentException("A subject cannot review themself.", nameof(reviewerId));
        if (string.IsNullOrWhiteSpace(reviewerName)) throw new ArgumentException("A reviewer name is required.", nameof(reviewerName));
        if (ReviewerEmployeeId == reviewerId && ReviewerDisplayName == reviewerName.Trim()
            && ReviewerBasis == global::EY.HRPlatform.Performance.Domain.Population.ReviewerBasis.AdministrativeAssignment) return;
        ReviewerEmployeeId = reviewerId;
        ReviewerDisplayName = reviewerName.Trim();
        ReviewerBasis = global::EY.HRPlatform.Performance.Domain.Population.ReviewerBasis.AdministrativeAssignment;
        MarkUpdated();
    }

    private void RequireDraft(ReviewRound round)
    {
        if (round.Id != ReviewRoundId) throw new InvalidOperationException("The subject belongs to another review round.");
        if (round.State != ReviewRoundState.Draft) throw new InvalidOperationException("Only a Draft review round can be configured.");
    }

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
