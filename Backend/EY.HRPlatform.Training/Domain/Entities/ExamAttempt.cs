using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class ExamAttempt : BaseEntity
{
    public Guid EmployeeId { get; private set; }
    public Guid ExamId { get; private set; }
    public Exam Exam { get; private set; } = null!;
    public Guid AssignmentId { get; private set; }
    public TrainingAssignment Assignment { get; private set; } = null!;
    public int Score { get; private set; }
    public bool Passed { get; private set; }
    public DateTime AttemptedAt { get; private set; } = DateTime.UtcNow;

    private ExamAttempt() { }

    public ExamAttempt(Guid employeeId, Guid examId, Guid assignmentId, int score, bool passed)
    {
        EmployeeId = employeeId;
        ExamId = examId;
        AssignmentId = assignmentId;
        Score = score;
        Passed = passed;
    }
}
