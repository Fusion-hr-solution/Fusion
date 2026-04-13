namespace EY.HRPlatform.Training.Models.Responses;

public class ChapterContentDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Layout { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public int TotalChapters { get; set; }
    public Guid? NextChapterId { get; set; }
    public Guid? PreviousChapterId { get; set; }
    public bool IsCompleted { get; set; }
    public List<ContentBlockDto> ContentBlocks { get; set; } = [];
}

public class ContentBlockDto
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public string? Title { get; set; }
    public string? TextContent { get; set; }
    public string? ContentUri { get; set; }
    public string? VideoUrl { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public bool IsCompleted { get; set; }
}
