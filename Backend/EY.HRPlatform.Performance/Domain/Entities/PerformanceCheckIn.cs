using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Events;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A manager-led check-in on a launched, planning-locked campaign. The effective reviewer plans it,
/// may reschedule or cancel it while Planned, and completes it with a shared summary. Terminal
/// records (Completed/Cancelled) are immutable; corrections are append-only addenda and the employee
/// may add exactly one immutable response. The reviewer identity is snapshotted so the record
/// narrates its own authorship even after a later reassignment.
/// </summary>
public sealed class PerformanceCheckIn : AggregateRoot, ITenantEntity
{
    public const int ReasonMaxLength = 500;
    public const int AgendaMaxLength = 2000;
    public const int SummaryMaxLength = 4000;
    public const int CancellationReasonMaxLength = 500;
    public const int TimeMaxLength = 16;

    private readonly List<PerformanceCheckInLinkedObjective> _linkedObjectives = new();
    private readonly List<PerformanceCheckInRescheduleEntry> _rescheduleHistory = new();
    private readonly List<PerformanceCheckInAddendum> _addenda = new();

    private PerformanceCheckIn() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid EmployeeId { get; private set; }

    /// <summary>The effective reviewer who created the check-in — snapshot, never rewritten.</summary>
    public Guid CreatedByReviewerId { get; private set; }
    public string CreatedByReviewerName { get; private set; } = string.Empty;

    /// <summary>How the creating reviewer was resolved (e.g. default approver, reassigned).</summary>
    public string ReviewerRelationship { get; private set; } = string.Empty;

    public DateTime PlannedDate { get; private set; }
    public string? PlannedTime { get; private set; }
    public string Reason { get; private set; } = string.Empty;
    public string? Agenda { get; private set; }
    public CheckInStatus Status { get; private set; }

    public string? CompletionSummary { get; private set; }
    public Guid? CompletedByReviewerId { get; private set; }
    public string? CompletedByReviewerName { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    public string? CancellationReason { get; private set; }
    public Guid? CancelledByReviewerId { get; private set; }
    public DateTime? CancelledAt { get; private set; }

    public uint Version { get; private set; }

    public PerformanceCheckInResponse? Response { get; private set; }

    public IReadOnlyCollection<PerformanceCheckInLinkedObjective> LinkedObjectives => _linkedObjectives.AsReadOnly();
    public IReadOnlyCollection<PerformanceCheckInRescheduleEntry> RescheduleHistory => _rescheduleHistory.AsReadOnly();
    public IReadOnlyCollection<PerformanceCheckInAddendum> Addenda => _addenda.AsReadOnly();

    public static PerformanceCheckIn Plan(
        Guid tenantId,
        Guid cycleId,
        Guid employeeId,
        Guid reviewerId,
        string reviewerName,
        string reviewerRelationship,
        DateTime plannedDate,
        string? plannedTime,
        string reason,
        string? agenda,
        DateTime now)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant is required.", nameof(tenantId));
        if (cycleId == Guid.Empty) throw new ArgumentException("Campaign is required.", nameof(cycleId));
        if (employeeId == Guid.Empty) throw new ArgumentException("Employee is required.", nameof(employeeId));
        if (reviewerId == Guid.Empty) throw new ArgumentException("Reviewer is required.", nameof(reviewerId));
        if (string.IsNullOrWhiteSpace(reviewerName)) throw new ArgumentException("Reviewer name is required.", nameof(reviewerName));
        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainRuleViolationException("A reason is required to plan a check-in.");
        if (reason.Trim().Length > ReasonMaxLength)
            throw new DomainRuleViolationException($"The reason cannot exceed {ReasonMaxLength} characters.");
        if (agenda is not null && agenda.Trim().Length > AgendaMaxLength)
            throw new DomainRuleViolationException($"The agenda cannot exceed {AgendaMaxLength} characters.");

        var plannedDateUtc = NormalizeDate(plannedDate, nameof(plannedDate));

        var checkIn = new PerformanceCheckIn
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            EmployeeId = employeeId,
            CreatedByReviewerId = reviewerId,
            CreatedByReviewerName = reviewerName.Trim(),
            ReviewerRelationship = (reviewerRelationship ?? string.Empty).Trim(),
            PlannedDate = plannedDateUtc,
            PlannedTime = NormalizeTime(plannedTime),
            Reason = reason.Trim(),
            Agenda = string.IsNullOrWhiteSpace(agenda) ? null : agenda.Trim(),
            Status = CheckInStatus.Planned
        };

        checkIn.AddDomainEvent(new CheckInPlannedEvent(
            tenantId, checkIn.Id, cycleId, employeeId, reviewerId, reviewerName.Trim(), plannedDateUtc));
        return checkIn;
    }

    /// <summary>Attach an objective from the participant's plan as planned agenda (validated by the caller).</summary>
    public void AddLinkedObjective(Guid objectiveId, string objectiveTitle)
    {
        EnsurePlanned();
        if (objectiveId == Guid.Empty)
            throw new ArgumentException("Objective is required.", nameof(objectiveId));
        if (_linkedObjectives.Any(item => item.ObjectiveId == objectiveId))
            return;
        _linkedObjectives.Add(PerformanceCheckInLinkedObjective.Create(Id, objectiveId, objectiveTitle));
    }

    public void Reschedule(
        DateTime newDate,
        string? newTime,
        Guid actorReviewerId,
        string actorName,
        DateTime now)
    {
        EnsurePlanned();
        var newDateUtc = NormalizeDate(newDate, nameof(newDate));
        var occurredAt = NormalizeUtc(now, nameof(now));
        var previousDate = PlannedDate;
        var previousTime = PlannedTime;

        _rescheduleHistory.Add(PerformanceCheckInRescheduleEntry.Create(
            Id, previousDate, previousTime, newDateUtc, NormalizeTime(newTime), actorReviewerId, actorName, occurredAt));
        PlannedDate = newDateUtc;
        PlannedTime = NormalizeTime(newTime);
        UpdatedAt = DateTime.UtcNow;

        AddDomainEvent(new CheckInRescheduledEvent(
            TenantId, Id, CycleId, EmployeeId, actorReviewerId, actorName.Trim(), previousDate, newDateUtc));
    }

    public void Cancel(string reason, Guid actorReviewerId, string actorName, DateTime now)
    {
        EnsurePlanned();
        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainRuleViolationException("A cancellation reason is required.");
        if (reason.Trim().Length > CancellationReasonMaxLength)
            throw new DomainRuleViolationException($"The cancellation reason cannot exceed {CancellationReasonMaxLength} characters.");

        Status = CheckInStatus.Cancelled;
        CancellationReason = reason.Trim();
        CancelledByReviewerId = actorReviewerId;
        CancelledAt = NormalizeUtc(now, nameof(now));
        UpdatedAt = DateTime.UtcNow;

        AddDomainEvent(new CheckInCancelledEvent(
            TenantId, Id, CycleId, EmployeeId, actorReviewerId, actorName.Trim(), reason.Trim()));
    }

    /// <summary>
    /// Complete the check-in with a required shared summary and the objectives actually discussed.
    /// Follow-up actions and linked-signal resolution are created as separate aggregates by the caller.
    /// </summary>
    public void Complete(
        string summary,
        IReadOnlyCollection<CheckInDiscussedObjective> discussedObjectives,
        Guid completedByReviewerId,
        string completedByReviewerName,
        DateTime now)
    {
        EnsurePlanned();
        if (string.IsNullOrWhiteSpace(summary))
            throw new DomainRuleViolationException("A discussion summary is required to complete a check-in.");
        if (summary.Trim().Length > SummaryMaxLength)
            throw new DomainRuleViolationException($"The summary cannot exceed {SummaryMaxLength} characters.");
        if (completedByReviewerId == Guid.Empty)
            throw new ArgumentException("Reviewer is required.", nameof(completedByReviewerId));
        if (string.IsNullOrWhiteSpace(completedByReviewerName))
            throw new ArgumentException("Reviewer name is required.", nameof(completedByReviewerName));

        foreach (var discussed in discussedObjectives ?? [])
        {
            var existing = _linkedObjectives.FirstOrDefault(item => item.ObjectiveId == discussed.ObjectiveId);
            if (existing is null)
            {
                var added = PerformanceCheckInLinkedObjective.Create(Id, discussed.ObjectiveId, discussed.ObjectiveTitle);
                added.MarkDiscussed();
                _linkedObjectives.Add(added);
            }
            else
            {
                existing.MarkDiscussed();
            }
        }

        Status = CheckInStatus.Completed;
        CompletionSummary = summary.Trim();
        CompletedByReviewerId = completedByReviewerId;
        CompletedByReviewerName = completedByReviewerName.Trim();
        CompletedAt = NormalizeUtc(now, nameof(now));
        UpdatedAt = DateTime.UtcNow;

        AddDomainEvent(new CheckInCompletedEvent(
            TenantId, Id, CycleId, EmployeeId, completedByReviewerId, completedByReviewerName.Trim()));
    }

    public void AddAddendum(Guid authorReviewerId, string authorName, string text, DateTime now)
    {
        EnsureCompleted();
        if (string.IsNullOrWhiteSpace(text))
            throw new DomainRuleViolationException("An addendum requires text.");
        if (text.Trim().Length > PerformanceCheckInAddendum.TextMaxLength)
            throw new DomainRuleViolationException($"The addendum cannot exceed {PerformanceCheckInAddendum.TextMaxLength} characters.");

        _addenda.Add(PerformanceCheckInAddendum.Create(Id, authorReviewerId, authorName, text, NormalizeUtc(now, nameof(now))));
        UpdatedAt = DateTime.UtcNow;

        AddDomainEvent(new CheckInAddendumAddedEvent(
            TenantId, Id, CycleId, EmployeeId, authorReviewerId, authorName.Trim()));
    }

    public void AddEmployeeResponse(Guid employeeId, string employeeName, string text, DateTime now)
    {
        EnsureCompleted();
        if (employeeId != EmployeeId)
            throw new DomainRuleViolationException("Only the participant can respond to their own check-in.");
        if (Response is not null)
            throw new DomainRuleViolationException("A response has already been recorded for this check-in.");
        if (string.IsNullOrWhiteSpace(text))
            throw new DomainRuleViolationException("A response requires text.");
        if (text.Trim().Length > PerformanceCheckInResponse.TextMaxLength)
            throw new DomainRuleViolationException($"The response cannot exceed {PerformanceCheckInResponse.TextMaxLength} characters.");

        Response = PerformanceCheckInResponse.Create(Id, employeeId, text, NormalizeUtc(now, nameof(now)));
        UpdatedAt = DateTime.UtcNow;

        AddDomainEvent(new CheckInResponseAddedEvent(
            TenantId, Id, CycleId, EmployeeId, (employeeName ?? string.Empty).Trim()));
    }

    private void EnsurePlanned()
    {
        if (Status != CheckInStatus.Planned)
            throw new DomainRuleViolationException("This check-in is no longer open.");
    }

    private void EnsureCompleted()
    {
        if (Status != CheckInStatus.Completed)
            throw new DomainRuleViolationException("This action is only available on a completed check-in.");
    }

    private static string? NormalizeTime(string? time)
        => string.IsNullOrWhiteSpace(time) ? null : time.Trim();

    private static DateTime NormalizeDate(DateTime value, string paramName)
    {
        if (value == default)
            throw new ArgumentException("A valid date is required.", paramName);
        return NormalizeUtc(value, paramName);
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

/// <summary>An objective marked as actually discussed at check-in completion.</summary>
public sealed record CheckInDiscussedObjective(Guid ObjectiveId, string ObjectiveTitle);
