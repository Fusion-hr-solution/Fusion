using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Events;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// An employee-raised `Needs discussion` signal against one of their objectives. It gives the
/// employee a voice without a second check-in lifecycle: the reviewer resolves it either by linking
/// a check-in (resolved on that check-in's completion) or by closing it with a reason. A signal
/// linked to a check-in that is later cancelled returns to <see cref="DiscussionSignalStatus.Open"/>
/// so the attention queue stays truthful.
/// </summary>
public sealed class ObjectiveDiscussionSignal : AggregateRoot, ITenantEntity
{
    public const int NoteMaxLength = 500;
    public const int CloseReasonMaxLength = 500;

    private ObjectiveDiscussionSignal() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid PlanId { get; private set; }
    public Guid ObjectiveId { get; private set; }
    public Guid RaisedByEmployeeId { get; private set; }
    public string ObjectiveTitle { get; private set; } = string.Empty;
    public string? Note { get; private set; }
    public DiscussionSignalStatus Status { get; private set; }
    public Guid? LinkedCheckInId { get; private set; }
    public Guid? ResolvedByCheckInId { get; private set; }
    public string? CloseReason { get; private set; }
    public DateTime RaisedAt { get; private set; }
    public DateTime? ResolvedAt { get; private set; }
    public uint Version { get; private set; }

    public static ObjectiveDiscussionSignal Raise(
        Guid tenantId,
        Guid cycleId,
        Guid planId,
        Guid objectiveId,
        Guid raisedByEmployeeId,
        string objectiveTitle,
        string employeeName,
        string? note,
        DateTime now)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant is required.", nameof(tenantId));
        if (objectiveId == Guid.Empty) throw new ArgumentException("Objective is required.", nameof(objectiveId));
        if (raisedByEmployeeId == Guid.Empty) throw new ArgumentException("Employee is required.", nameof(raisedByEmployeeId));
        if (note is not null && note.Trim().Length > NoteMaxLength)
            throw new DomainRuleViolationException($"The note cannot exceed {NoteMaxLength} characters.");

        var signal = new ObjectiveDiscussionSignal
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            PlanId = planId,
            ObjectiveId = objectiveId,
            RaisedByEmployeeId = raisedByEmployeeId,
            ObjectiveTitle = (objectiveTitle ?? string.Empty).Trim(),
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            Status = DiscussionSignalStatus.Open,
            RaisedAt = NormalizeUtc(now, nameof(now))
        };

        signal.AddDomainEvent(new DiscussionSignalRaisedEvent(
            tenantId, signal.Id, cycleId, planId, objectiveId, raisedByEmployeeId,
            (employeeName ?? string.Empty).Trim(), signal.ObjectiveTitle));
        return signal;
    }

    /// <summary>Link an open signal to a check-in the reviewer is planning to address it.</summary>
    public void LinkToCheckIn(Guid checkInId)
    {
        EnsureOpen();
        if (checkInId == Guid.Empty)
            throw new ArgumentException("Check-in is required.", nameof(checkInId));
        LinkedCheckInId = checkInId;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Resolve the signal when its linked check-in completes.</summary>
    public void ResolveByCheckIn(Guid checkInId, DateTime now)
    {
        if (Status != DiscussionSignalStatus.Open)
            return;
        ResolvedByCheckInId = checkInId;
        LinkedCheckInId = checkInId;
        Status = DiscussionSignalStatus.ResolvedByCheckIn;
        ResolvedAt = NormalizeUtc(now, nameof(now));
        UpdatedAt = DateTime.UtcNow;

        AddDomainEvent(new DiscussionSignalResolvedEvent(
            TenantId, Id, CycleId, ObjectiveId, RaisedByEmployeeId, checkInId));
    }

    /// <summary>Return a linked signal to Open when its check-in is cancelled.</summary>
    public void ReturnToOpen()
    {
        if (Status != DiscussionSignalStatus.Open)
            return;
        LinkedCheckInId = null;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>The reviewer closes an open signal with a short reason, without a check-in.</summary>
    public void Close(Guid reviewerId, string reason, DateTime now)
    {
        EnsureOpen();
        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainRuleViolationException("A reason is required to close a discussion signal.");
        if (reason.Trim().Length > CloseReasonMaxLength)
            throw new DomainRuleViolationException($"The reason cannot exceed {CloseReasonMaxLength} characters.");

        Status = DiscussionSignalStatus.Closed;
        CloseReason = reason.Trim();
        ResolvedAt = NormalizeUtc(now, nameof(now));
        UpdatedAt = DateTime.UtcNow;

        AddDomainEvent(new DiscussionSignalClosedEvent(
            TenantId, Id, CycleId, ObjectiveId, RaisedByEmployeeId, reviewerId, reason.Trim()));
    }

    private void EnsureOpen()
    {
        if (Status != DiscussionSignalStatus.Open)
            throw new DomainRuleViolationException("This discussion signal is no longer open.");
    }

    private static DateTime NormalizeUtc(DateTime value, string paramName)
    {
        if (value == default)
            throw new ArgumentException("A valid date is required.", paramName);

        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}
