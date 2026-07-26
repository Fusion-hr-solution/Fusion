using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// An append-only correction to a Completed check-in. The original summary is never mutated; a
/// genuine correction is captured here with its own author, timestamp, and text.
/// </summary>
public sealed class PerformanceCheckInAddendum : BaseEntity
{
    public const int TextMaxLength = 2000;

    private PerformanceCheckInAddendum() { }

    public Guid CheckInId { get; private set; }
    public Guid AuthorReviewerId { get; private set; }
    public string AuthorName { get; private set; } = string.Empty;
    public string Text { get; private set; } = string.Empty;
    public DateTime CreatedAtUtc { get; private set; }

    internal static PerformanceCheckInAddendum Create(
        Guid checkInId,
        Guid authorReviewerId,
        string authorName,
        string text,
        DateTime createdAtUtc)
        => new()
        {
            Id = Guid.NewGuid(),
            CheckInId = checkInId,
            AuthorReviewerId = authorReviewerId,
            AuthorName = (authorName ?? string.Empty).Trim(),
            Text = (text ?? string.Empty).Trim(),
            CreatedAtUtc = createdAtUtc
        };
}
