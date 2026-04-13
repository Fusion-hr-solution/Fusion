using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

public class TrainingChapter : BaseEntity
{
    public string Title { get; private set; } = string.Empty;
    public ChapterLayout Layout { get; private set; } = ChapterLayout.SingleContent;
    public int OrderIndex { get; private set; }

    public Guid TrainingId { get; private set; }
    public TrainingCourse Training { get; private set; } = null!;

    private readonly List<ContentBlock> _contentBlocks = [];
    public IReadOnlyCollection<ContentBlock> ContentBlocks => _contentBlocks.AsReadOnly();

    private readonly List<ChapterProgress> _progressRecords = [];
    public IReadOnlyCollection<ChapterProgress> ProgressRecords => _progressRecords.AsReadOnly();

    private TrainingChapter() { }

    public TrainingChapter(
        string title,
        ChapterLayout layout,
        int orderIndex,
        Guid trainingId)
    {
        Title = title;
        Layout = layout;
        OrderIndex = orderIndex;
        TrainingId = trainingId;
    }

    public void Update(string title, ChapterLayout layout)
    {
        Title = title;
        Layout = layout;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reorder(int orderIndex)
    {
        OrderIndex = orderIndex;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AddContentBlock(ContentBlock block)
    {
        _contentBlocks.Add(block);
    }
}
