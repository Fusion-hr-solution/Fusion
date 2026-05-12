namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>Detailed view of a single session, including training/part context and (placeholder) attendees.</summary>
public class TrainingSessionDetailDto
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
    public decimal CapacityRatio => MaxCapacity == 0 ? 0 : (decimal)EnrolledCount / MaxCapacity;
    public bool CapacityWarning => CapacityRatio >= 0.9m;
    public string? Notes { get; set; }
    public Guid? TrainerEmployeeId { get; set; }
    public string? TrainerName { get; set; }
    public string? TrainerEmail { get; set; }
    public string Status { get; set; } = "Planned";
    public string? CancelReason { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<SessionAttendeeDto> Attendees { get; set; } = [];
}

public class SessionAttendeeDto
{
    public Guid EmployeeId { get; set; }
    public string? FullName { get; set; }
    public string? Email { get; set; }
}
