using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class TrainingCategory : AggregateRoot
{
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    private readonly List<TrainingCourse> _trainings = [];
    public IReadOnlyCollection<TrainingCourse> Trainings => _trainings.AsReadOnly();

    private TrainingCategory() { }

    public TrainingCategory(string name, string? description = null)
    {
        Name = name;
        Description = description;
    }

    public void Update(string name, string? description)
    {
        Name = name;
        Description = description;
        UpdatedAt = DateTime.UtcNow;
    }
}
