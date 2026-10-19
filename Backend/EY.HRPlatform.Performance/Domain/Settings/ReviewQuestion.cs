using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Settings;

/// <summary>Who answers a review question: the person reviewed, their manager, or a peer.</summary>
public enum ReviewQuestionAudience { Person, Manager, Peer }

public enum ReviewQuestionState { Active, Archived }

/// <summary>
/// One open question in the tenant's review library (D-19). Rounds pick questions and freeze their text at
/// launch, so editing or archiving a question never changes a launched round. Used questions are archived,
/// never deleted.
/// </summary>
public sealed class ReviewQuestion : PerformanceAggregate
{
    public const int MinLength = 5;
    public const int MaxLength = 300;

    private ReviewQuestion() { }

    public string Text { get; private set; } = string.Empty;
    public ReviewQuestionAudience Audience { get; private set; }
    public int SortOrder { get; private set; }
    public ReviewQuestionState State { get; private set; }
    public DateTime? FirstUsedAt { get; private set; }

    public static ReviewQuestion Create(Guid tenantId, string text, ReviewQuestionAudience audience, int sortOrder)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId is required.", nameof(tenantId));
        if (!Enum.IsDefined(audience)) throw new ArgumentException("Choose the person, the manager or peers.", nameof(audience));
        return new ReviewQuestion
        {
            TenantId = tenantId,
            Text = Normalize(text),
            Audience = audience,
            SortOrder = sortOrder,
            State = ReviewQuestionState.Active,
        };
    }

    public void Update(string text)
    {
        if (State != ReviewQuestionState.Active) throw new InvalidOperationException("Archived questions cannot be edited.");
        var value = Normalize(text);
        if (value == Text) return;
        Text = value;
        MarkUpdated();
    }

    public void MoveTo(int sortOrder)
    {
        if (SortOrder == sortOrder) return;
        SortOrder = sortOrder;
        MarkUpdated();
    }

    public void Archive()
    {
        if (State == ReviewQuestionState.Archived) return;
        State = ReviewQuestionState.Archived;
        MarkUpdated();
    }

    public void MarkUsed(DateTime at)
    {
        if (State != ReviewQuestionState.Active) throw new InvalidOperationException("Only active questions can be used.");
        if (FirstUsedAt is null) { FirstUsedAt = at; MarkUpdated(); }
    }

    private static string Normalize(string text)
    {
        var value = text?.Trim() ?? string.Empty;
        if (value.Length is < MinLength or > MaxLength)
            throw new ArgumentException($"A question needs {MinLength} to {MaxLength} characters.", nameof(text));
        return value;
    }
}

/// <summary>The nine questions a tenant's library starts with: three per audience.</summary>
public static class ReviewQuestionDefaults
{
    public static readonly IReadOnlyList<(ReviewQuestionAudience Audience, string Text)> Questions =
    [
        (ReviewQuestionAudience.Person, "What are you most proud of this year?"),
        (ReviewQuestionAudience.Person, "What got in your way?"),
        (ReviewQuestionAudience.Person, "What do you want to learn next?"),
        (ReviewQuestionAudience.Manager, "What should they keep doing?"),
        (ReviewQuestionAudience.Manager, "Where would you like to see them grow?"),
        (ReviewQuestionAudience.Manager, "How did they support the team?"),
        (ReviewQuestionAudience.Peer, "What is one thing they do really well?"),
        (ReviewQuestionAudience.Peer, "What could they do differently?"),
        (ReviewQuestionAudience.Peer, "How was it working with them?"),
    ];

    public static IReadOnlyList<ReviewQuestion> Create(Guid tenantId)
        => Questions.GroupBy(item => item.Audience)
            .SelectMany(group => group.Select((item, index) => ReviewQuestion.Create(tenantId, item.Text, item.Audience, index)))
            .ToArray();
}
