using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

/// <summary>
/// Duplicate a session with a new start date. Optional recurrence creates multiple occurrences
/// (one per <see cref="IntervalDays"/> for <see cref="Occurrences"/> times).
/// </summary>
public class DuplicateSessionRequest
{
    /// <summary>New start time for the first duplicate (UTC).</summary>
    [Required]
    public DateTime NewStartUtc { get; set; }

    /// <summary>How many duplicates to create (default 1).</summary>
    [Range(1, 52)]
    public int Occurrences { get; set; } = 1;

    /// <summary>Days between each occurrence (default 7 = weekly).</summary>
    [Range(1, 365)]
    public int IntervalDays { get; set; } = 7;
}
