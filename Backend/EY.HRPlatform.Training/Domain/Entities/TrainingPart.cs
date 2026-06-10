using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class TrainingPart : BaseEntity
{
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public int OrderIndex { get; private set; }
    public decimal DurationHours { get; private set; }
    public bool IsLocked { get; private set; }

    public Guid TrainingId { get; private set; }
    public TrainingCourse Training { get; private set; } = null!;

    private readonly List<TrainingSession> _sessions = [];
    public IReadOnlyCollection<TrainingSession> Sessions => _sessions.AsReadOnly();

    private TrainingPart() { }

    public TrainingPart(
        Guid trainingId,
        string title,
        string? description,
        int orderIndex,
        decimal durationHours)
    {
        TrainingId = trainingId;
        Title = title;
        Description = description;
        OrderIndex = orderIndex;
        DurationHours = durationHours;
    }

    public void Update(string title, string? description, decimal durationHours)
    {
        Title = title;
        Description = description;
        DurationHours = durationHours;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reorder(int orderIndex)
    {
        OrderIndex = orderIndex;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Lock()
    {
        IsLocked = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Unlock()
    {
        IsLocked = false;
        UpdatedAt = DateTime.UtcNow;
    }
}
