using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Events;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A lightweight follow-up action agreed at a check-in's completion. It carries a description, an
/// owner (employee or reviewer), a due date, an optional linked objective, and its originating
/// check-in. Its lifecycle is <c>Open → Completed | Cancelled</c>; overdue is always derived from
/// the due date, never stored. The owner completes their own action; the reviewer cancels with a
/// reason. Terminal actions are read-only and status changes are append-only.
/// </summary>
public sealed class CheckInFollowUpAction : AggregateRoot, ITenantEntity
{
    public const int DescriptionMaxLength = 1000;
    public const int NoteMaxLength = 500;

    private readonly List<CheckInFollowUpActionStatusEvent> _statusEvents = new();

    private CheckInFollowUpAction() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid CheckInId { get; private set; }

    /// <summary>The participant employee the originating check-in belongs to.</summary>
    public Guid EmployeeId { get; private set; }

    public string Description { get; private set; } = string.Empty;
    public FollowUpActionOwnerKind OwnerKind { get; private set; }
    public Guid OwnerEmployeeId { get; private set; }
    public string OwnerName { get; private set; } = string.Empty;
    public DateTime DueDate { get; private set; }
    public Guid? LinkedObjectiveId { get; private set; }
    public FollowUpActionStatus Status { get; private set; }
    public string? ResolutionNote { get; private set; }
    public DateTime? ResolvedAt { get; private set; }
    public uint Version { get; private set; }

    public IReadOnlyCollection<CheckInFollowUpActionStatusEvent> StatusEvents => _statusEvents.AsReadOnly();

    public static CheckInFollowUpAction Create(
        Guid tenantId,
        Guid cycleId,
        Guid checkInId,
        Guid employeeId,
        string description,
        FollowUpActionOwnerKind ownerKind,
        Guid ownerEmployeeId,
        string ownerName,
        DateTime dueDate,
        Guid? linkedObjectiveId,
        DateTime now)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant is required.", nameof(tenantId));
        if (checkInId == Guid.Empty) throw new ArgumentException("Check-in is required.", nameof(checkInId));
        if (ownerEmployeeId == Guid.Empty) throw new ArgumentException("Owner is required.", nameof(ownerEmployeeId));
        if (string.IsNullOrWhiteSpace(description))
            throw new DomainRuleViolationException("A follow-up action requires a description.");
        if (description.Trim().Length > DescriptionMaxLength)
            throw new DomainRuleViolationException($"The description cannot exceed {DescriptionMaxLength} characters.");

        var dueDateUtc = NormalizeUtc(dueDate, nameof(dueDate));
        var action = new CheckInFollowUpAction
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            CheckInId = checkInId,
            EmployeeId = employeeId,
            Description = description.Trim(),
            OwnerKind = ownerKind,
            OwnerEmployeeId = ownerEmployeeId,
            OwnerName = (ownerName ?? string.Empty).Trim(),
            DueDate = dueDateUtc,
            LinkedObjectiveId = linkedObjectiveId == Guid.Empty ? null : linkedObjectiveId,
            Status = FollowUpActionStatus.Open
        };

        action.AddDomainEvent(new FollowUpActionCreatedEvent(
            tenantId, action.Id, checkInId, cycleId, employeeId, ownerKind, ownerEmployeeId,
            action.OwnerName, action.Description, dueDateUtc));
        return action;
    }

    /// <summary>The owner marks their own Open action complete, optionally with a note.</summary>
    public void Complete(Guid actorEmployeeId, string actorName, string? note, DateTime now)
    {
        EnsureOpen();
        if (actorEmployeeId != OwnerEmployeeId)
            throw new DomainRuleViolationException("Only the action owner can complete this action.");
        if (note is not null && note.Trim().Length > NoteMaxLength)
            throw new DomainRuleViolationException($"The note cannot exceed {NoteMaxLength} characters.");

        var occurredAt = NormalizeUtc(now, nameof(now));
        _statusEvents.Add(CheckInFollowUpActionStatusEvent.Create(
            Id, FollowUpActionStatus.Open, FollowUpActionStatus.Completed, actorEmployeeId, actorName, note, occurredAt));
        Status = FollowUpActionStatus.Completed;
        ResolutionNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        ResolvedAt = occurredAt;
        UpdatedAt = DateTime.UtcNow;

        AddDomainEvent(new FollowUpActionCompletedEvent(
            TenantId, Id, CheckInId, CycleId, EmployeeId, OwnerEmployeeId, (actorName ?? string.Empty).Trim()));
    }

    /// <summary>The reviewer cancels an Open action with a required reason.</summary>
    public void Cancel(Guid reviewerId, string reviewerName, string reason, DateTime now)
    {
        EnsureOpen();
        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainRuleViolationException("A cancellation reason is required.");
        if (reason.Trim().Length > NoteMaxLength)
            throw new DomainRuleViolationException($"The reason cannot exceed {NoteMaxLength} characters.");

        var occurredAt = NormalizeUtc(now, nameof(now));
        _statusEvents.Add(CheckInFollowUpActionStatusEvent.Create(
            Id, FollowUpActionStatus.Open, FollowUpActionStatus.Cancelled, reviewerId, reviewerName, reason, occurredAt));
        Status = FollowUpActionStatus.Cancelled;
        ResolutionNote = reason.Trim();
        ResolvedAt = occurredAt;
        UpdatedAt = DateTime.UtcNow;

        AddDomainEvent(new FollowUpActionCancelledEvent(
            TenantId, Id, CheckInId, CycleId, EmployeeId, reviewerId, (reviewerName ?? string.Empty).Trim(), reason.Trim()));
    }

    private void EnsureOpen()
    {
        if (Status != FollowUpActionStatus.Open)
            throw new DomainRuleViolationException("This follow-up action is no longer open.");
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
