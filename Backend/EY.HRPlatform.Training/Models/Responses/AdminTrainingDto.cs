namespace EY.HRPlatform.Training.Models.Responses;

public class AdminTrainingDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Credits { get; set; }
    public bool IsMandatory { get; set; }
    public string BadgeLevel { get; set; } = string.Empty;
    public string? Duration { get; set; }
    public Guid CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public int ChapterCount { get; set; }
    public int EnrollmentCount { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
