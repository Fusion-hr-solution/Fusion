using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// P1.6 closure record that excludes a frozen participant from planning lock readiness.
/// The frozen participant row remains unchanged.
/// </summary>
public sealed class PerformanceCycleParticipantExclusion : BaseEntity, ITenantEntity
{
    public const int ReasonMaxLength = 1000;

    private PerformanceCycleParticipantExclusion() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid ParticipantEmployeeId { get; private set; }
    public string Reason { get; private set; } = string.Empty;
    public Guid? ExcludedByUserId { get; private set; }
    public string? ExcludedByName { get; private set; }
    public DateTime ExcludedAt { get; private set; }

    public static PerformanceCycleParticipantExclusion Create(
        Guid tenantId,
        Guid cycleId,
        Guid participantEmployeeId,
        string reason,
        Guid? excludedByUserId,
        string? excludedByName,
        DateTime excludedAt)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (cycleId == Guid.Empty)
            throw new ArgumentException("CycleId cannot be empty.", nameof(cycleId));
        if (participantEmployeeId == Guid.Empty)
            throw new ArgumentException("A participant is required.", nameof(participantEmployeeId));

        var normalizedReason = NormalizeRequired(reason, nameof(reason), ReasonMaxLength);
        return new PerformanceCycleParticipantExclusion
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            ParticipantEmployeeId = participantEmployeeId,
            Reason = normalizedReason,
            ExcludedByUserId = excludedByUserId,
            ExcludedByName = string.IsNullOrWhiteSpace(excludedByName) ? null : excludedByName.Trim(),
            ExcludedAt = NormalizeUtc(excludedAt)
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
