namespace EY.HRPlatform.Training.Models.Responses;

public class TrainingPartDto
{
    public Guid Id { get; set; }
    public Guid TrainingId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int OrderIndex { get; set; }
    public decimal DurationHours { get; set; }
    public bool IsLocked { get; set; }
    public int SessionCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<TrainingSessionDto> Sessions { get; set; } = [];
}
