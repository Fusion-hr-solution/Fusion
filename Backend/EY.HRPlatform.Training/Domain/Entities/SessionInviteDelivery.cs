using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// Per-(session, attendee) iMIP delivery tracking: the last SEQUENCE + METHOD actually sent, so an
/// outbox retry never double-invites. A fresh attendee starts at LastSentSequence = -1 (nothing sent).
/// </summary>
public class SessionInviteDelivery : BaseEntity
{
    public Guid SessionId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string? EmployeeEmail { get; private set; }
    public string? EmployeeName { get; private set; }
    public int LastSentSequence { get; private set; } = -1;
    public InviteMethod? LastSentMethod { get; private set; }
    public DateTime? SentAtUtc { get; private set; }

    private SessionInviteDelivery() { }

    public SessionInviteDelivery(Guid sessionId, Guid employeeId, string? employeeEmail, string? employeeName)
    {
        SessionId = sessionId;
        EmployeeId = employeeId;
        EmployeeEmail = employeeEmail;
        EmployeeName = employeeName;
    }

    /// <summary>
    /// Idempotency guard: send when the sequence advanced, or when re-sending at the same sequence
    /// with a different method (e.g. a CANCEL after a REQUEST when an attendee leaves).
    /// </summary>
    public bool ShouldSend(int sequence, InviteMethod method)
        => sequence > LastSentSequence
           || (sequence == LastSentSequence && method != LastSentMethod);

    public void RecordSent(int sequence, InviteMethod method)
    {
        LastSentSequence = sequence;
        LastSentMethod = method;
        SentAtUtc = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }
}
