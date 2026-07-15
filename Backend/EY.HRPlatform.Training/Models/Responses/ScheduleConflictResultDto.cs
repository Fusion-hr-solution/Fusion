namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>
/// Result of a schedule-conflict probe for a candidate session window: room overlaps and
/// (verifiable) trainer overlaps. Conflicts warn the admin — they never block scheduling.
/// </summary>
public class ScheduleConflictResultDto
{
    public List<ScheduleConflictItemDto> RoomConflicts { get; set; } = [];
    public List<ScheduleConflictItemDto> TrainerConflicts { get; set; } = [];

    /// <summary>
    /// False when the candidate trainer is an external trainer known only by free-text name
    /// (no internal id, no email): trainer overlap cannot be verified, so <see cref="TrainerConflicts"/>
    /// is empty and the caller should surface a soft "unverifiable" note rather than a clean bill.
    /// </summary>
    public bool TrainerCheckable { get; set; }

    public bool HasConflicts => RoomConflicts.Count > 0 || TrainerConflicts.Count > 0;
}

public class ScheduleConflictItemDto
{
    public Guid SessionId { get; set; }
    public Guid PartId { get; set; }
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public string PartTitle { get; set; } = string.Empty;
    public string Room { get; set; } = string.Empty;
    public string? TrainerName { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
}
