using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class ContentBlockProgress : BaseEntity
{
    public Guid EmployeeId { get; private set; }
    public Guid ContentBlockId { get; private set; }
    public ContentBlock ContentBlock { get; private set; } = null!;
    public bool Completed { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    private ContentBlockProgress() { }

    public ContentBlockProgress(Guid employeeId, Guid contentBlockId)
    {
        EmployeeId = employeeId;
        ContentBlockId = contentBlockId;
    }

    public void MarkCompleted()
    {
        Completed = true;
        CompletedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }
}
