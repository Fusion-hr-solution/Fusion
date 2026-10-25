using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Notifications;

/// <summary>
/// One person's email choices for Performance notifications (B-071 D8), kept for the recipient the feed uses: their
/// employee record or, without one, their account. No row means every group is emailed.
/// </summary>
public sealed class NotificationPreference : PerformanceAggregate
{
    private NotificationPreference() { }

    public Guid? RecipientEmployeeId { get; private set; }
    public Guid? RecipientUserId { get; private set; }

    /// <summary>The optional groups whose email is turned off.</summary>
    public List<string> EmailOff { get; private set; } = [];

    public static NotificationPreference For(Guid tenantId, Guid? employeeId, Guid? userId)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId is required.", nameof(tenantId));
        if (employeeId is null && userId is null) throw new ArgumentException("A preference needs a recipient.");
        return new NotificationPreference { TenantId = tenantId, RecipientEmployeeId = employeeId, RecipientUserId = employeeId is null ? userId : null };
    }

    public bool EmailsGroup(string group) => NotificationGroups.IsLocked(group) || !EmailOff.Contains(group);

    /// <summary>Replaces the groups turned off. Deadline reminders and unknown groups can't be turned off.</summary>
    public void SetEmailOff(IReadOnlyCollection<string> groups)
    {
        if (groups.Any(group => !NotificationGroups.Optional.Contains(group)))
            throw new ArgumentException("Only plans and goals, reviews and calibration, 1:1s, and feedback and praise email can be turned off.", nameof(groups));
        var next = NotificationGroups.Optional.Where(groups.Contains).ToList();
        if (next.SequenceEqual(EmailOff)) return;
        EmailOff = next;
        MarkUpdated();
    }
}
