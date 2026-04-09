using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

public class ContentBlock : BaseEntity
{
    public string? Title { get; private set; }
    public ContentType Type { get; private set; }
    public int OrderIndex { get; private set; }
    public string? TextContent { get; private set; }
    public string? ContentUri { get; private set; }
    public string? VideoUrl { get; private set; }
    public int? EstimatedDurationMinutes { get; private set; }

    public Guid ChapterId { get; private set; }
    public TrainingChapter Chapter { get; private set; } = null!;

    private readonly List<ContentBlockProgress> _progressRecords = [];
    public IReadOnlyCollection<ContentBlockProgress> ProgressRecords => _progressRecords.AsReadOnly();

    private ContentBlock() { }

    public ContentBlock(
        ContentType type,
        int orderIndex,
        Guid chapterId,
        string? title = null,
        string? textContent = null,
        string? contentUri = null,
        string? videoUrl = null,
        int? estimatedDurationMinutes = null)
    {
        Type = type;
        OrderIndex = orderIndex;
        ChapterId = chapterId;
        Title = title;
        TextContent = textContent;
        ContentUri = contentUri;
        VideoUrl = videoUrl;
        EstimatedDurationMinutes = estimatedDurationMinutes;
    }

    public void Update(
        ContentType type,
        string? title,
        string? textContent,
        string? contentUri,
        string? videoUrl,
        int? estimatedDurationMinutes)
    {
        Type = type;
        Title = title;
        TextContent = textContent;
        ContentUri = contentUri;
        VideoUrl = videoUrl;
        EstimatedDurationMinutes = estimatedDurationMinutes;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reorder(int orderIndex)
    {
        OrderIndex = orderIndex;
        UpdatedAt = DateTime.UtcNow;
    }
}
