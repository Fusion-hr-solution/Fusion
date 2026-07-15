namespace EY.HRPlatform.Training.Models.Responses;

public class TrainingSessionDto
{
    public Guid Id { get; set; }
    public Guid PartId { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string Room { get; set; } = string.Empty;
    public int MaxCapacity { get; set; }
    public int EnrolledCount { get; set; }
    public string? Notes { get; set; }
    public Guid? TrainerEmployeeId { get; set; }
    public string? TrainerName { get; set; }
    public string? TrainerEmail { get; set; }
    public string Status { get; set; } = "Planned";
    public string? CancelReason { get; set; }
    public DateTime? CancelledAt { get; set; }
    public decimal? ExternalTrainerCost { get; set; }
    public decimal? VenueCost { get; set; }
    public decimal? MaterialsCost { get; set; }
    public decimal? OtherCost { get; set; }
    public decimal? TotalCost { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
