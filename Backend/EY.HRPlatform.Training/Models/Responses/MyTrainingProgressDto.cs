namespace EY.HRPlatform.Training.Models.Responses;

public class MyTrainingProgressDto
{
    public Guid TrainingId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string? Duration { get; set; }
    public int Credits { get; set; }
    public bool IsMandatory { get; set; }
    public string BadgeLevel { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int ProgressPercentage { get; set; }
    public int CompletedChapters { get; set; }
    public int TotalChapters { get; set; }
    public List<ChapterDetailDto> Chapters { get; set; } = [];
    public List<ChapterProgressDto> ChapterProgress { get; set; } = [];
}

public class ChapterDetailDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Layout { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public int BlockCount { get; set; }
    public int CompletedBlockCount { get; set; }
}

public class ChapterProgressDto
{
    public Guid ChapterId { get; set; }
    public bool Completed { get; set; }
    public DateTime? CompletedAt { get; set; }
}
