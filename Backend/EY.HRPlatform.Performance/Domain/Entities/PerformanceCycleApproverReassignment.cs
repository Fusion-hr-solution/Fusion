using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// Campaign-specific reviewer reassignment history. It never updates Core reporting lines
/// and never rewrites the frozen P1.2 approver baseline.
/// </summary>
public sealed class PerformanceCycleApproverReassignment : BaseEntity, ITenantEntity
{
    public const int ReasonMaxLength = 1000;

    private PerformanceCycleApproverReassignment() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid ParticipantEmployeeId { get; private set; }
    public Guid? PreviousApproverEmployeeId { get; private set; }
    public string? PreviousApproverName { get; private set; }
    public Guid NewApproverEmployeeId { get; private set; }
    public string NewApproverName { get; private set; } = string.Empty;
    public string Reason { get; private set; } = string.Empty;
    public Guid? ReassignedByUserId { get; private set; }
    public string? ReassignedByName { get; private set; }
    public DateTime ReassignedAt { get; private set; }

    public static PerformanceCycleApproverReassignment Create(
        Guid tenantId,
        Guid cycleId,
        Guid participantEmployeeId,
        Guid? previousApproverEmployeeId,
        string? previousApproverName,
        Guid newApproverEmployeeId,
        string newApproverName,
        string reason,
        Guid? reassignedByUserId,
        string? reassignedByName,
        DateTime reassignedAt)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (cycleId == Guid.Empty)
            throw new ArgumentException("CycleId cannot be empty.", nameof(cycleId));
        if (participantEmployeeId == Guid.Empty)
            throw new ArgumentException("A participant is required.", nameof(participantEmployeeId));
        if (newApproverEmployeeId == Guid.Empty)
            throw new ArgumentException("A new reviewer is required.", nameof(newApproverEmployeeId));
        if (string.IsNullOrWhiteSpace(newApproverName))
            throw new ArgumentException("A new reviewer name is required.", nameof(newApproverName));

        var normalizedReason = NormalizeRequired(reason, nameof(reason), ReasonMaxLength);
        return new PerformanceCycleApproverReassignment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            ParticipantEmployeeId = participantEmployeeId,
            PreviousApproverEmployeeId = previousApproverEmployeeId,
            PreviousApproverName = string.IsNullOrWhiteSpace(previousApproverName) ? null : previousApproverName.Trim(),
            NewApproverEmployeeId = newApproverEmployeeId,
            NewApproverName = newApproverName.Trim(),
            Reason = normalizedReason,
            ReassignedByUserId = reassignedByUserId,
            ReassignedByName = string.IsNullOrWhiteSpace(reassignedByName) ? null : reassignedByName.Trim(),
            ReassignedAt = NormalizeUtc(reassignedAt)
        };
    }

    private static string NormalizeRequired(string value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("A reason is required.", paramName);

        var normalized = value.Trim();
        if (normalized.Length > maxLength)
            throw new ArgumentException($"Reason cannot exceed {maxLength} characters.", paramName);

        return normalized;
    }

    private static DateTime NormalizeUtc(DateTime value)
        => value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
}
