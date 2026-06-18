using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

public class TrainingSession : BaseEntity
{
    public Guid PartId { get; private set; }
    public TrainingPart Part { get; private set; } = null!;

    public DateTime StartUtc { get; private set; }
    public DateTime EndUtc { get; private set; }
    public string Room { get; private set; } = string.Empty;
    public int MaxCapacity { get; private set; }
    public string? Notes { get; private set; }

    public Guid? TrainerEmployeeId { get; private set; }
    public string? TrainerName { get; private set; }
    public string? TrainerEmail { get; private set; }

    /// <summary>Optional online-meeting join link (admin-pasted); orthogonal to OnSite/ELearning.</summary>
    public string? MeetingUrl { get; private set; }

    public SessionStatus Status { get; private set; } = SessionStatus.Planned;
    public string? CancelReason { get; private set; }
    public DateTime? CancelledAt { get; private set; }

    private TrainingSession() { }

    public TrainingSession(
        Guid partId,
        DateTime startUtc,
        DateTime endUtc,
        string room,
        int maxCapacity,
        string? notes,
        Guid? trainerEmployeeId,
        string? trainerName,
        string? trainerEmail)
    {
        PartId = partId;
        StartUtc = startUtc;
        EndUtc = endUtc;
        Room = room;
        MaxCapacity = maxCapacity;
        Notes = notes;
        TrainerEmployeeId = trainerEmployeeId;
        TrainerName = trainerName;
        TrainerEmail = trainerEmail;
        Status = SessionStatus.Planned;
    }

    public void Update(
        DateTime startUtc,
        DateTime endUtc,
        string room,
        int maxCapacity,
        string? notes,
        Guid? trainerEmployeeId,
        string? trainerName,
        string? trainerEmail)
    {
        StartUtc = startUtc;
        EndUtc = endUtc;
        Room = room;
        MaxCapacity = maxCapacity;
        Notes = notes;
        TrainerEmployeeId = trainerEmployeeId;
        TrainerName = trainerName;
        TrainerEmail = trainerEmail;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkInProgress()
    {
        Status = SessionStatus.InProgress;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkCompleted()
    {
        Status = SessionStatus.Completed;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Update only trainer info and notes (allowed on completed sessions).</summary>
    public void UpdateTrainerAndNotes(
        string? notes,
        Guid? trainerEmployeeId,
        string? trainerName,
        string? trainerEmail)
    {
        Notes = notes;
        TrainerEmployeeId = trainerEmployeeId;
        TrainerName = trainerName;
        TrainerEmail = trainerEmail;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Cancel(string reason)
    {
        Status = SessionStatus.Cancelled;
        CancelReason = reason;
        CancelledAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetMeetingUrl(string? meetingUrl)
    {
        MeetingUrl = string.IsNullOrWhiteSpace(meetingUrl) ? null : meetingUrl.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Compute the effective status based on current time (used for read-time projection).</summary>
    public SessionStatus EffectiveStatus(DateTime nowUtc)
    {
        if (Status is SessionStatus.Cancelled or SessionStatus.Completed)
            return Status;
        if (nowUtc >= EndUtc) return SessionStatus.Completed;
        if (nowUtc >= StartUtc) return SessionStatus.InProgress;
        return SessionStatus.Planned;
    }
}
