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
        bool byExplicitInclusion)
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
        };
    }
}
