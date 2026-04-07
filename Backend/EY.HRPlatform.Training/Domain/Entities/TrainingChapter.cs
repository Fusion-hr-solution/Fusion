using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

public class TrainingChapter : BaseEntity
{
    public string Title { get; private set; } = string.Empty;
    public ContentType ContentType { get; private set; }
    public string? ContentUri { get; private set; }
    public int OrderIndex { get; private set; }
    public string? TextContent { get; private set; }
    public string? VideoUrl { get; private set; }
    public int? EstimatedDurationMinutes { get; private set; }

    public Guid TrainingId { get; private set; }
    public TrainingCourse Training { get; private set; } = null!;

    private readonly List<ChapterProgress> _progressRecords = [];
    public IReadOnlyCollection<ChapterProgress> ProgressRecords => _progressRecords.AsReadOnly();

    private TrainingChapter() { }

    public TrainingChapter(
        string title,
        ContentType contentType,
        string? contentUri,
        int orderIndex,
        Guid trainingId,
        string? textContent = null,
        string? videoUrl = null,
        int? estimatedDurationMinutes = null)
    {
        Title = title;
        ContentType = contentType;
        ContentUri = contentUri;
        OrderIndex = orderIndex;
        TrainingId = trainingId;
        TextContent = textContent;
        VideoUrl = videoUrl;
        EstimatedDurationMinutes = estimatedDurationMinutes;
    }

    public void Update(
        string title,
        ContentType contentType,
        string? contentUri,
        int orderIndex,
        string? textContent = null,
        string? videoUrl = null,
        int? estimatedDurationMinutes = null)
    {
        Title = title;
        ContentType = contentType;
        ContentUri = contentUri;
        OrderIndex = orderIndex;
        TextContent = textContent;
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
