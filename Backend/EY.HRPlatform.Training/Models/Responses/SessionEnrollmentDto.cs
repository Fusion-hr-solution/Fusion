namespace EY.HRPlatform.Training.Models.Responses;

public class SessionEnrollmentDto
{
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public Guid EmployeeId { get; set; }
    public string Status { get; set; } = string.Empty;
    public int WaitlistPosition { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime? AttendedAt { get; set; }
}
