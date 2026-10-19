using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Reviews;

public enum ReviewQuestionAuthor { Self, Manager }

/// <summary>A free-text answer to one of the round's frozen questions, saved with its side's assessment (D2).</summary>
public sealed class ReviewQuestionAnswer : PerformanceChildEntity
{
    public const int MaxLength = 4000;

    private ReviewQuestionAnswer() { }

    public Guid ReviewId { get; private set; }
    public Guid QuestionSnapshotId { get; private set; }
    public ReviewQuestionAuthor Author { get; private set; }
    public string Text { get; private set; } = string.Empty;

    internal static ReviewQuestionAnswer Create(Guid tenantId, Guid reviewId, Guid questionSnapshotId, ReviewQuestionAuthor author, string text)
    {
        if (questionSnapshotId == Guid.Empty) throw new ArgumentException("An answer needs its question.", nameof(questionSnapshotId));
        return new ReviewQuestionAnswer
        {
            TenantId = tenantId, ReviewId = reviewId, QuestionSnapshotId = questionSnapshotId, Author = author, Text = Normalize(text),
        };
    }

    internal void Change(string text)
    {
        var value = Normalize(text);
        if (value == Text) return;
        Text = value;
        MarkUpdated();
    }

    private static string Normalize(string text)
    {
        var value = text.Trim();
        if (value.Length > MaxLength) throw new ArgumentException($"An answer can be up to {MaxLength:N0} characters.", nameof(text));
        return value;
    }
}

public enum PeerNominationSource { Subject, Reviewer }

/// <summary>A colleague on a review's peer list: nominated by the person, or added by the reviewer when approving.</summary>
public sealed class PeerNomination : PerformanceChildEntity
{
    private PeerNomination() { }

    public Guid ReviewId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string DisplayName { get; private set; } = string.Empty;
    public PeerNominationSource Source { get; private set; }
    public DateTime NominatedAt { get; private set; }

    internal static PeerNomination Create(Guid tenantId, Guid reviewId, Guid employeeId, string displayName,
        PeerNominationSource source, DateTime at)
        => new()
        {
            TenantId = tenantId, ReviewId = reviewId, EmployeeId = employeeId, DisplayName = displayName.Trim(),
            Source = source, NominatedAt = at,
        };
}

/// <summary>What the reviewer changed when approving: nominees left out and colleagues added (a swap is one of each).</summary>
public sealed record PeerListDecision(IReadOnlyList<Guid> Removed, IReadOnlyList<Guid> Added);
