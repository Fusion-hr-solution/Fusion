using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// An in-app notification delivered to a single recipient (the user account behind an employee).
/// Generated on cycle lifecycle events and by the deadline reminder sweep.
/// </summary>
public class PerformanceNotification : BaseEntity, ITenantEntity
{
    private PerformanceNotification() { }

    public Guid TenantId { get; private set; }

    /// <summary>The recipient Core employee id (matched against the caller's employee_id claim).</summary>
    public Guid RecipientEmployeeId { get; private set; }

    public Guid? CycleId { get; private set; }
    public PerformanceNotificationType Type { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Message { get; private set; } = string.Empty;
    public DateTime? ReadAt { get; private set; }

    /// <summary>Generic subject type (e.g. EmployeeObjectivePlan) so notifications are not cycle-only.</summary>
    public string? SubjectType { get; private set; }

    /// <summary>Identifier of the generic subject the notification concerns.</summary>
    public Guid? SubjectId { get; private set; }

    /// <summary>Contextual frontend route the notification deep-links to when activated.</summary>
    public string? NavigationRoute { get; private set; }

    /// <summary>
    /// Idempotency key used to avoid generating duplicate reminders for the same recipient,
    /// cycle, type and time window. Null for non-deduped notifications.
    /// </summary>
    public string? DedupKey { get; private set; }

    public bool IsRead => ReadAt.HasValue;

    public static PerformanceNotification Create(
        Guid tenantId,
        Guid recipientEmployeeId,
        PerformanceNotificationType type,
        string title,
        string message,
        Guid? cycleId = null,
        string? dedupKey = null,
        string? subjectType = null,
        Guid? subjectId = null,
        string? navigationRoute = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (recipientEmployeeId == Guid.Empty)
            throw new ArgumentException("RecipientEmployeeId cannot be empty.", nameof(recipientEmployeeId));

        return new PerformanceNotification
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RecipientEmployeeId = recipientEmployeeId,
            Type = type,
            Title = string.IsNullOrWhiteSpace(title) ? type.ToString() : title.Trim(),
            Message = message?.Trim() ?? string.Empty,
            CycleId = cycleId,
            DedupKey = dedupKey,
            SubjectType = string.IsNullOrWhiteSpace(subjectType) ? null : subjectType.Trim(),
            SubjectId = subjectId,
            NavigationRoute = string.IsNullOrWhiteSpace(navigationRoute) ? null : navigationRoute.Trim(),
        };
    }

    public void MarkRead()
    {
        if (ReadAt.HasValue)
            return;

        ReadAt = DateTime.UtcNow;
        UpdatedAt = ReadAt;
    }
}
