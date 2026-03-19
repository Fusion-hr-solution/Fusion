using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class ChapterProgress : BaseEntity
{
    public Guid EmployeeId { get; private set; }
    public Guid ChapterId { get; private set; }
    public TrainingChapter Chapter { get; private set; } = null!;
    public bool Completed { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    private ChapterProgress() { }

    public ChapterProgress(Guid employeeId, Guid chapterId)
    {
        EmployeeId = employeeId;
        ChapterId = chapterId;
    }

    public void MarkCompleted()
    {
        Completed = true;
        CompletedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }
}
