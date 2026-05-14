using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

public class SessionEnrollment : BaseEntity
{
    public Guid SessionId { get; private set; }
    public TrainingSession Session { get; private set; } = null!;

    public Guid EmployeeId { get; private set; }
    public string? EmployeeName { get; private set; }
    public string? EmployeeEmail { get; private set; }
    public EnrollmentStatus Status { get; private set; }

    public int WaitlistPosition { get; private set; }
    public DateTime? CancelledAt { get; private set; }
    public DateTime? AttendedAt { get; private set; }

    private SessionEnrollment() { }

    public SessionEnrollment(Guid sessionId, Guid employeeId, EnrollmentStatus status, int waitlistPosition = 0, string? employeeName = null, string? employeeEmail = null)
    {
        SessionId = sessionId;
        EmployeeId = employeeId;
        EmployeeName = employeeName;
        EmployeeEmail = employeeEmail;
        Status = status;
        WaitlistPosition = waitlistPosition;
    }

    public void Cancel()
    {
        Status = EnrollmentStatus.Cancelled;
        CancelledAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void PromoteFromWaitlist()
    {
        Status = EnrollmentStatus.Enrolled;
        WaitlistPosition = 0;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkAttended()
    {
        Status = EnrollmentStatus.Attended;
        AttendedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }
}
