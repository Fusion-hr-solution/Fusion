using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// Lightweight P1.6 reminder history. Delivery is optional; this record is the durable intent.
/// </summary>
public sealed class PerformancePlanningReminder : BaseEntity, ITenantEntity
{
    public const int TargetTypeMaxLength = 40;
    public const int TargetNameMaxLength = 256;
    public const int ReasonMaxLength = 1000;

    private PerformancePlanningReminder() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid? ParticipantEmployeeId { get; private set; }
    public Guid? PlanId { get; private set; }
    public Guid TargetEmployeeId { get; private set; }
    public string TargetName { get; private set; } = string.Empty;
    public string TargetType { get; private set; } = string.Empty;
    public string Reason { get; private set; } = string.Empty;
    public Guid? RecordedByUserId { get; private set; }
    public string? RecordedByName { get; private set; }
    public DateTime RecordedAt { get; private set; }
    public bool NotificationTriggered { get; private set; }

    public static PerformancePlanningReminder Create(
        Guid tenantId,
        Guid cycleId,
        Guid? participantEmployeeId,
        Guid? planId,
        Guid targetEmployeeId,
        string targetName,
        string targetType,
        string reason,
        Guid? recordedByUserId,
        string? recordedByName,
        DateTime recordedAt,
        bool notificationTriggered)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (cycleId == Guid.Empty)
            throw new ArgumentException("CycleId cannot be empty.", nameof(cycleId));
        if (targetEmployeeId == Guid.Empty)
            throw new ArgumentException("A reminder target is required.", nameof(targetEmployeeId));

        return new PerformancePlanningReminder
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            ParticipantEmployeeId = participantEmployeeId == Guid.Empty ? null : participantEmployeeId,
            PlanId = planId == Guid.Empty ? null : planId,
            TargetEmployeeId = targetEmployeeId,
            TargetName = NormalizeRequired(targetName, nameof(targetName), TargetNameMaxLength),
            TargetType = NormalizeRequired(targetType, nameof(targetType), TargetTypeMaxLength),
            Reason = NormalizeRequired(reason, nameof(reason), ReasonMaxLength),
            RecordedByUserId = recordedByUserId,
            RecordedByName = string.IsNullOrWhiteSpace(recordedByName) ? null : recordedByName.Trim(),
            RecordedAt = NormalizeUtc(recordedAt),
            NotificationTriggered = notificationTriggered
        };
    }

    private static string NormalizeRequired(string value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("A value is required.", paramName);

        var normalized = value.Trim();
        if (normalized.Length > maxLength)
            throw new ArgumentException($"Value cannot exceed {maxLength} characters.", paramName);

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
