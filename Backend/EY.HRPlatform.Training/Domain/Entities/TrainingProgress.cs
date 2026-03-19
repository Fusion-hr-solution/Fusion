using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

public class TrainingProgress : BaseEntity
{
    public Guid EmployeeId { get; private set; }
    public Guid TrainingId { get; private set; }
    public TrainingCourse Training { get; private set; } = null!;
    public TrainingStatus Status { get; private set; } = TrainingStatus.NotStarted;
    public int ProgressPercentage { get; private set; }
    public DateTime? StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    private TrainingProgress() { }

    public TrainingProgress(Guid employeeId, Guid trainingId)
    {
        EmployeeId = employeeId;
        TrainingId = trainingId;
    }

    public void Start()
    {
        Status = TrainingStatus.InProgress;
        StartedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateProgress(int percentage)
    {
        ProgressPercentage = percentage;
        UpdatedAt = DateTime.UtcNow;

        if (percentage >= 100)
        {
            Complete();
        }
    }

    public void Complete()
    {
        Status = TrainingStatus.Completed;
        ProgressPercentage = 100;
        CompletedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Fail()
    {
        Status = TrainingStatus.Failed;
        UpdatedAt = DateTime.UtcNow;
    }
}
