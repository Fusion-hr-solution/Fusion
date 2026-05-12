namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>Row of the global session management table (cross-training).</summary>
public class TrainingSessionListItemDto
{
    public Guid Id { get; set; }
    public Guid PartId { get; set; }
    public string PartTitle { get; set; } = string.Empty;
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string Room { get; set; } = string.Empty;
    public int MaxCapacity { get; set; }
    public int EnrolledCount { get; set; }
    public string? TrainerName { get; set; }
    public Guid? TrainerEmployeeId { get; set; }
    public string Status { get; set; } = "Planned";
}
