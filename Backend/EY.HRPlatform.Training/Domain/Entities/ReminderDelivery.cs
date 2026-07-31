using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// One reminder actually sent — the dedupe record. The unique key
/// (SessionId, EmployeeId, OffsetMinutes, Channel) ensures a reminder fires at most once per learner
/// per offset per channel, even across catch-up scans and restarts.
/// </summary>
public class ReminderDelivery : BaseEntity
{
    public Guid SessionId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public int OffsetMinutes { get; private set; }
    public string Channel { get; private set; } = "Email";
    public DateTime SentAtUtc { get; private set; } = DateTime.UtcNow;

    private ReminderDelivery() { }

    public ReminderDelivery(Guid sessionId, Guid employeeId, int offsetMinutes, string channel)
    {
        SessionId = sessionId;
        EmployeeId = employeeId;
        OffsetMinutes = offsetMinutes;
        Channel = channel;
    }
}
