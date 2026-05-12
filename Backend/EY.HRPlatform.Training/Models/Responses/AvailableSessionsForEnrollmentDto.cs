namespace EY.HRPlatform.Training.Models.Responses;

public class AvailableSessionsForEnrollmentDto
{
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public List<PartWithSessionsDto> Parts { get; set; } = [];
}

public class PartWithSessionsDto
{
    public Guid PartId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int OrderIndex { get; set; }
    public decimal DurationHours { get; set; }
    public List<AvailableSessionDto> Sessions { get; set; } = [];
}

public class AvailableSessionDto
{
    public Guid SessionId { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string Room { get; set; } = string.Empty;
    public string? TrainerName { get; set; }
    public string? TrainerEmail { get; set; }
    public int MaxCapacity { get; set; }
    public int EnrolledCount { get; set; }
    public int AvailableSpots { get; set; }
    public bool IsFull { get; set; }
    public string Status { get; set; } = string.Empty;
}
