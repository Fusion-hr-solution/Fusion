namespace EY.HRPlatform.Training.Models.Responses;

public class AdminTrainingDetailDto
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
    public int EnrollmentCount { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<AdminChapterDto> Chapters { get; set; } = [];
    public List<ExamDto> Exams { get; set; } = [];
}

public class AdminChapterDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public string? ContentUri { get; set; }
    public int OrderIndex { get; set; }
    public string? TextContent { get; set; }
    public string? VideoUrl { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
