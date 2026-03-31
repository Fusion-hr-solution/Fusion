namespace EY.HRPlatform.Training.Models.Responses;

public class ChapterContentDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public string? ContentUri { get; set; }
    public string? TextContent { get; set; }
    public string? VideoUrl { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public int OrderIndex { get; set; }
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public int TotalChapters { get; set; }
    public Guid? NextChapterId { get; set; }
    public Guid? PreviousChapterId { get; set; }
    public bool IsCompleted { get; set; }
}
