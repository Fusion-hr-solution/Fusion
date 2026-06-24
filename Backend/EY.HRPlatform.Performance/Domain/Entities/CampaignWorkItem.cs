using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// An executable task derived from an immutable campaign assignment at activation.
/// It deliberately references Core people by id only; display and relationship facts belong
/// to the campaign launch snapshot.
/// </summary>
public sealed class CampaignWorkItem : AggregateRoot, ITenantEntity
{
    private CampaignWorkItem() { }

    public Guid TenantId { get; private set; }
    public uint Version { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid SubjectEmployeeId { get; private set; }
    public Guid AssigneeEmployeeId { get; private set; }
    public CampaignWorkItemType Type { get; private set; }
    public CampaignWorkItemStatus Status { get; private set; }
    public DateTime DueAt { get; private set; }
    public DateTime? SubmittedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public Guid? SourceAssignmentRevisionId { get; private set; }
    public Guid? ExceptionCaseId { get; private set; }

    public static CampaignWorkItem Create(
        Guid tenantId,
        Guid cycleId,
        Guid subjectEmployeeId,
        Guid assigneeEmployeeId,
        CampaignWorkItemType type,
        DateTime dueAt,
        Guid? sourceAssignmentRevisionId = null)
    {
        if (tenantId == Guid.Empty || cycleId == Guid.Empty || subjectEmployeeId == Guid.Empty || assigneeEmployeeId == Guid.Empty)
            throw new ArgumentException("Tenant, campaign, subject, and assignee are required.");
        if (!Enum.IsDefined(type))
            throw new ArgumentOutOfRangeException(nameof(type));
        if (type is CampaignWorkItemType.ManagerReview or CampaignWorkItemType.ObjectiveApproval or CampaignWorkItemType.TeamObjectiveApproval
            && subjectEmployeeId == assigneeEmployeeId)
            throw new DomainRuleViolationException("A manager or approver work item cannot be self-assigned.");

        return new CampaignWorkItem
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            SubjectEmployeeId = subjectEmployeeId,
            AssigneeEmployeeId = assigneeEmployeeId,
            Type = type,
            DueAt = NormalizeUtc(dueAt),
            Status = CampaignWorkItemStatus.Assigned,
            SourceAssignmentRevisionId = sourceAssignmentRevisionId
        };
    }

    public void LinkToExceptionCase(Guid exceptionCaseId)
    {
        if (exceptionCaseId == Guid.Empty)
            throw new ArgumentException("A valid exception case id is required.", nameof(exceptionCaseId));

        ExceptionCaseId = exceptionCaseId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Begin()
    {
        if (Status != CampaignWorkItemStatus.Assigned)
            throw new DomainRuleViolationException("Only an assigned work item can be started.");
        Status = CampaignWorkItemStatus.InProgress;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Submit(DateTime occurredAt)
    {
        if (Status is not (CampaignWorkItemStatus.Assigned or CampaignWorkItemStatus.InProgress))
            throw new DomainRuleViolationException("Only an assigned or in-progress work item can be submitted.");
        Status = CampaignWorkItemStatus.Submitted;
        SubmittedAt = NormalizeUtc(occurredAt);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Complete(DateTime occurredAt)
    {
        if (Status != CampaignWorkItemStatus.Submitted)
            throw new DomainRuleViolationException("Only a submitted work item can be completed.");
        Status = CampaignWorkItemStatus.Completed;
        CompletedAt = NormalizeUtc(occurredAt);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Cancel()
    {
        if (Status is CampaignWorkItemStatus.Completed or CampaignWorkItemStatus.Cancelled)
            throw new DomainRuleViolationException("A completed or cancelled work item cannot be cancelled.");
        Status = CampaignWorkItemStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
    }

    private static DateTime NormalizeUtc(DateTime value)
    {
        if (value == default)
            throw new ArgumentException("A valid due date is required.", nameof(value));
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}
