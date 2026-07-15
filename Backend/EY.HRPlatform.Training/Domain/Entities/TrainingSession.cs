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

    public SessionStatus Status { get; private set; } = SessionStatus.Planned;
    public string? CancelReason { get; private set; }
    public DateTime? CancelledAt { get; private set; }

    // External-trainer costs (Feature 7.2). Set only on external-trainer sessions; null = free/internal.
    public decimal? ExternalTrainerCost { get; private set; }
    public decimal? VenueCost { get; private set; }
    public decimal? MaterialsCost { get; private set; }
    public decimal? OtherCost { get; private set; }

    /// <summary>Computed, never stored. Null when all four parts are null; otherwise the sum of the non-null parts.</summary>
    public decimal? TotalCost =>
        (ExternalTrainerCost is null && VenueCost is null && MaterialsCost is null && OtherCost is null)
            ? null
            : (ExternalTrainerCost ?? 0m) + (VenueCost ?? 0m) + (MaterialsCost ?? 0m) + (OtherCost ?? 0m);

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
        string? trainerEmail,
        decimal? externalTrainerCost = null,
        decimal? venueCost = null,
        decimal? materialsCost = null,
        decimal? otherCost = null)
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
        ExternalTrainerCost = externalTrainerCost;
        VenueCost = venueCost;
        MaterialsCost = materialsCost;
        OtherCost = otherCost;
    }

    public void Update(
        DateTime startUtc,
        DateTime endUtc,
        string room,
        int maxCapacity,
        string? notes,
        Guid? trainerEmployeeId,
        string? trainerName,
        string? trainerEmail,
        decimal? externalTrainerCost = null,
        decimal? venueCost = null,
        decimal? materialsCost = null,
        decimal? otherCost = null)
    {
        StartUtc = startUtc;
        EndUtc = endUtc;
        Room = room;
        MaxCapacity = maxCapacity;
        Notes = notes;
        TrainerEmployeeId = trainerEmployeeId;
        TrainerName = trainerName;
        TrainerEmail = trainerEmail;
        ExternalTrainerCost = externalTrainerCost;
        VenueCost = venueCost;
        MaterialsCost = materialsCost;
        OtherCost = otherCost;
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
