namespace EY.HRPlatform.Training.Models.Responses;

public class ChapterListItemDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
}
