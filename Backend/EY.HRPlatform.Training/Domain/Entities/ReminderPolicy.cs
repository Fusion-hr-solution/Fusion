using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// Global reminder configuration: whether session reminders are sent and the lead-time offsets
/// (minutes before a session's StartUtc), default 24h + 1h. A single row, admin-editable.
/// </summary>
public class ReminderPolicy : BaseEntity
{
    public bool Enabled { get; private set; } = true;

    /// <summary>Comma-separated lead times in minutes before the session start (e.g. "1440,60").</summary>
    public string OffsetsMinutes { get; private set; } = "1440,60";

    private ReminderPolicy() { }

    public ReminderPolicy(bool enabled, string offsetsMinutes)
    {
        Enabled = enabled;
        OffsetsMinutes = offsetsMinutes;
    }

    public IReadOnlyList<int> Offsets() =>
        OffsetsMinutes
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => int.TryParse(s, out var v) ? v : -1)
            .Where(v => v > 0)
            .Distinct()
            .OrderByDescending(v => v)
            .ToList();

    public void Update(bool enabled, IEnumerable<int> offsets)
    {
        Enabled = enabled;
        OffsetsMinutes = string.Join(',', offsets.Where(o => o > 0).Distinct().OrderByDescending(o => o));
        UpdatedAt = DateTime.UtcNow;
    }
}
