namespace EY.HRPlatform.Training.Models.Responses;

public class ChapterListItemDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Layout { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public int BlockCount { get; set; }
    public int CompletedBlockCount { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
}
