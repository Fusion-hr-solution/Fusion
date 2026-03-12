using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

public class TrainingAssignment : BaseEntity
{
    public Guid TrainingId { get; private set; }
    public TrainingCourse Training { get; private set; } = null!;
    public Guid EmployeeId { get; private set; }
    public AssignmentType AssignmentType { get; private set; }
    public DateTime AssignedAt { get; private set; } = DateTime.UtcNow;
    public DateTime? DueDate { get; private set; }

    private TrainingAssignment() { }

    public TrainingAssignment(Guid trainingId, Guid employeeId, AssignmentType assignmentType, DateTime? dueDate = null)
    {
        TrainingId = trainingId;
        EmployeeId = employeeId;
        AssignmentType = assignmentType;
        DueDate = dueDate;
    }
}
