using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class OnSiteCourse : BaseEntity
{
    public string Title { get; private set; } = string.Empty;
    public string ContentUri { get; private set; } = string.Empty;
    public int OrderIndex { get; private set; }

    public Guid TrainingId { get; private set; }
    public TrainingCourse Training { get; private set; } = null!;

    private OnSiteCourse() { }

    public OnSiteCourse(string title, string contentUri, int orderIndex, Guid trainingId)
    {
        Title = title;
        ContentUri = contentUri;
        OrderIndex = orderIndex;
        TrainingId = trainingId;
    }

    public void Update(string title, string contentUri)
    {
        Title = title;
        ContentUri = contentUri;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reorder(int orderIndex)
    {
        OrderIndex = orderIndex;
        UpdatedAt = DateTime.UtcNow;
    }
}
