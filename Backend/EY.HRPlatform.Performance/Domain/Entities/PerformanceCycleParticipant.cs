using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// An immutable snapshot of a Core employee captured into a cycle at publish time.
/// Performance references Core people but never owns them; the snapshot preserves
/// historical correctness once the cycle is in flight or closed.
/// </summary>
public class PerformanceCycleParticipant : BaseEntity, ITenantEntity
{
    private PerformanceCycleParticipant() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }

    /// <summary>The Core employee id this participant references.</summary>
    public Guid EmployeeId { get; private set; }

    // Denormalised snapshot fields (frozen at publish).
    public string? EmployeeKey { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public Guid? OrgUnitId { get; private set; }
    public string? OrgUnitName { get; private set; }
    public string? JobTitle { get; private set; }
    public Guid? ManagerId { get; private set; }
    public string? ManagerName { get; private set; }
    // Packet A legacy-read projections. They remain only until the data cutover removes the
    // old planning-approver model; no campaign transition may use them as authority.
    public Guid? PlanningApproverEmployeeId { get; private set; }
    public string? PlanningApproverName { get; private set; }
    public PlanningApproverSource PlanningApproverSource { get; private set; }
    public string? PlanningApproverOverrideReason { get; private set; }
    public DateTime SnapshotAt { get; private set; }

    public bool HasResolvedPlanningApprover => PlanningApproverEmployeeId.HasValue;

    public static PerformanceCycleParticipant Create(
        Guid tenantId,
        Guid cycleId,
        Guid employeeId,
        string fullName,
        string? employeeKey = null,
        string? email = null,
        Guid? orgUnitId = null,
        string? orgUnitName = null,
        string? jobTitle = null,
        Guid? managerId = null,
        string? managerName = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (cycleId == Guid.Empty)
            throw new ArgumentException("CycleId cannot be empty.", nameof(cycleId));
        if (employeeId == Guid.Empty)
            throw new ArgumentException("EmployeeId cannot be empty.", nameof(employeeId));

        return new PerformanceCycleParticipant
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            EmployeeId = employeeId,
            FullName = string.IsNullOrWhiteSpace(fullName) ? "(unknown)" : fullName.Trim(),
            EmployeeKey = employeeKey,
            Email = email,
            OrgUnitId = orgUnitId,
            OrgUnitName = orgUnitName,
            JobTitle = jobTitle,
            ManagerId = managerId,
            ManagerName = managerName,
            PlanningApproverEmployeeId = null,
            PlanningApproverName = null,
            PlanningApproverSource = PlanningApproverSource.Unresolved,
            SnapshotAt = DateTime.UtcNow
        };
    }

    public void AssignPlanningApprover(Guid approverEmployeeId, string approverName, string reason)
    {
        if (approverEmployeeId == Guid.Empty)
            throw new ArgumentException("Planning approver id cannot be empty.", nameof(approverEmployeeId));
        if (approverEmployeeId == EmployeeId)
            throw new DomainRuleViolationException("A participant cannot approve their own planning.");
        if (string.IsNullOrWhiteSpace(approverName))
            throw new ArgumentException("Planning approver name is required.", nameof(approverName));
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("A reason is required when assigning a planning approver.", nameof(reason));

        var normalizedReason = reason.Trim();
        if (normalizedReason.Length > 1000)
            throw new ArgumentException("Planning approver override reason cannot exceed 1000 characters.", nameof(reason));

        PlanningApproverEmployeeId = approverEmployeeId;
        PlanningApproverName = approverName.Trim();
        PlanningApproverSource = PlanningApproverSource.ManualAssignment;
        PlanningApproverOverrideReason = normalizedReason;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AssignEscalatedPlanningApprover(Guid approverEmployeeId, string approverName)
    {
        if (approverEmployeeId == Guid.Empty)
            throw new ArgumentException("Planning approver id cannot be empty.", nameof(approverEmployeeId));
        if (approverEmployeeId == EmployeeId)
            throw new DomainRuleViolationException("A participant cannot approve their own planning.");
        if (string.IsNullOrWhiteSpace(approverName))
            throw new ArgumentException("Planning approver name is required.", nameof(approverName));

        PlanningApproverEmployeeId = approverEmployeeId;
        PlanningApproverName = approverName.Trim();
        PlanningApproverSource = PlanningApproverSource.EscalatedManager;
        PlanningApproverOverrideReason = null;
        UpdatedAt = DateTime.UtcNow;
    }
}
