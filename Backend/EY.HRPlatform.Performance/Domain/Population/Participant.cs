using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Population;

/// <summary>
/// One confirmed roster member of a Cycle, unique per employee within the Cycle. Carries a
/// captured display context (name, org unit, manager) so the roster keeps historical meaning
/// even as live Core data changes after activation. Created at population confirmation.
/// </summary>
public sealed class Participant : PerformanceChildEntity
{
    private Participant() { }

    public Guid CycleId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string DisplayName { get; private set; } = string.Empty;
    public string? JobTitle { get; private set; }
    public Guid? OrgUnitId { get; private set; }
    public string? OrgUnitName { get; private set; }
    public Guid? ManagerEmployeeId { get; private set; }
    public string? ManagerDisplayName { get; private set; }

    /// <summary>How the employee entered the roster: by the rule or by explicit inclusion.</summary>
    public bool ByExplicitInclusion { get; private set; }

    /// <summary>Why <see cref="ManagerEmployeeId"/> is the responsible reviewer.</summary>
    public ReviewerBasis ReviewerBasis { get; private set; }

    /// <summary>The date the reviewer responsibility was resolved as of.</summary>
    public DateOnly ReviewerAsOf { get; private set; }

    /// <summary>Why the participant was closed out of the Cycle without an approved plan, when they were.</summary>
    public string? ClosureExceptionReason { get; private set; }

    public void RecordClosureException(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("A closure exception requires a reason.", nameof(reason));
        var trimmed = reason.Trim();
        if (trimmed.Length > 1000)
            throw new ArgumentException("The closure exception reason must be 1000 characters or fewer.", nameof(reason));
        ClosureExceptionReason = trimmed;
    }

    public static Participant Create(
        Guid tenantId,
        Guid cycleId,
        Guid employeeId,
        string displayName,
        string? jobTitle,
        Guid? orgUnitId,
        string? orgUnitName,
        Guid? managerEmployeeId,
        string? managerDisplayName,
        bool byExplicitInclusion,
        DateOnly reviewerAsOf,
        ReviewerBasis reviewerBasis = ReviewerBasis.CoreManagerAtCycleStart)
    {
        if (employeeId == Guid.Empty) throw new ArgumentException("EmployeeId is required.", nameof(employeeId));

        return new Participant
        {
            TenantId = tenantId,
            CycleId = cycleId,
            EmployeeId = employeeId,
            DisplayName = displayName,
            JobTitle = jobTitle,
            OrgUnitId = orgUnitId,
            OrgUnitName = orgUnitName,
            ManagerEmployeeId = managerEmployeeId,
            ManagerDisplayName = managerDisplayName,
            ByExplicitInclusion = byExplicitInclusion,
            ReviewerBasis = reviewerBasis,
            ReviewerAsOf = reviewerAsOf,
        };
    }
}
