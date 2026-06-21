using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A cycle-bound SMART objective. Core identities are referenced only by immutable IDs;
/// the launch snapshot provides the historical workforce context.
/// </summary>
public sealed class PerformanceObjective : AggregateRoot, ITenantEntity
{
    private PerformanceObjective() { }

    public Guid TenantId { get; private set; }
    public uint Version { get; private set; }
    public Guid CycleId { get; private set; }
    public ObjectiveLevel Level { get; private set; }
    public Guid OwnerEmployeeId { get; private set; }
    public Guid? ParentObjectiveId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string SuccessMeasure { get; private set; } = string.Empty;
    public string Target { get; private set; } = string.Empty;
    public DateTime DueDate { get; private set; }
    public decimal? Weight { get; private set; }
    public ObjectiveStatus Status { get; private set; }
    public DateTime? SubmittedAt { get; private set; }
    public DateTime? ApprovedAt { get; private set; }

    public static PerformanceObjective Create(
        Guid tenantId,
        Guid cycleId,
        ObjectiveLevel level,
        Guid ownerEmployeeId,
        string title,
        string? description,
        string successMeasure,
        string target,
        DateTime dueDate,
        decimal? weight,
        Guid? parentObjectiveId = null)
    {
        if (tenantId == Guid.Empty || cycleId == Guid.Empty || ownerEmployeeId == Guid.Empty)
            throw new ArgumentException("Tenant, cycle, and objective owner are required.");
        if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(successMeasure) || string.IsNullOrWhiteSpace(target))
            throw new ArgumentException("SMART objectives require title, success measure, and target.");
        if (weight is < 0 or > 100)
            throw new ArgumentOutOfRangeException(nameof(weight), "Weight must be between 0 and 100.");

        var normalizedDueDate = NormalizeUtc(dueDate, nameof(dueDate));
        return new PerformanceObjective
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            Level = level,
            OwnerEmployeeId = ownerEmployeeId,
            ParentObjectiveId = parentObjectiveId,
            Title = RequireLength(title, 200, nameof(title)),
            Description = OptionalLength(description, 2000, nameof(description)),
            SuccessMeasure = RequireLength(successMeasure, 500, nameof(successMeasure)),
            Target = RequireLength(target, 500, nameof(target)),
            DueDate = normalizedDueDate,
            Weight = weight,
            Status = ObjectiveStatus.Draft,
        };
    }

    public void Submit(DateTime occurredAt)
    {
        if (Status is not (ObjectiveStatus.Draft or ObjectiveStatus.Returned))
            throw new DomainRuleViolationException("Only a draft or returned objective can be submitted.");

        Status = ObjectiveStatus.PendingApproval;
        SubmittedAt = NormalizeUtc(occurredAt, nameof(occurredAt));
        UpdatedAt = DateTime.UtcNow;
    }

    public void Approve(DateTime occurredAt)
    {
        if (Status != ObjectiveStatus.PendingApproval)
            throw new DomainRuleViolationException("Only a submitted objective can be approved.");

        Status = ObjectiveStatus.Approved;
        ApprovedAt = NormalizeUtc(occurredAt, nameof(occurredAt));
        UpdatedAt = DateTime.UtcNow;
    }

    private static string RequireLength(string value, int maximum, string parameterName)
    {
        var normalized = value.Trim();
        if (normalized.Length > maximum)
            throw new ArgumentException($"Value cannot exceed {maximum} characters.", parameterName);
        return normalized;
    }

    private static string? OptionalLength(string? value, int maximum, string parameterName)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return RequireLength(value, maximum, parameterName);
    }

    private static DateTime NormalizeUtc(DateTime value, string parameterName)
    {
        if (value == default) throw new ArgumentException("A valid date is required.", parameterName);
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        };
    }
}
