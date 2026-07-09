using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// An immutable snapshot of a Core employee captured into a campaign at launch time,
/// carrying the resolved approver (default primary manager or an HR override).
/// Performance references Core people but never owns them; the snapshot preserves
/// historical correctness once the campaign is launched.
/// </summary>
public class PerformanceCycleParticipant : BaseEntity, ITenantEntity
{
    private PerformanceCycleParticipant() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }

    /// <summary>The Core employee id this participant references.</summary>
    public Guid EmployeeId { get; private set; }

    // Denormalised snapshot fields (frozen at launch).
    public string? EmployeeKey { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public Guid? OrgUnitId { get; private set; }
    public string? OrgUnitName { get; private set; }
    public string? JobTitle { get; private set; }
    public Guid? ManagerId { get; private set; }
    public string? ManagerName { get; private set; }
    public DateTime SnapshotAt { get; private set; }

    // Resolved approver baseline (frozen at launch).
    public Guid ApproverEmployeeId { get; private set; }
    public string ApproverName { get; private set; } = string.Empty;
    public bool IsApproverOverridden { get; private set; }
    public string? ApproverOverrideReason { get; private set; }

    public static PerformanceCycleParticipant Create(
        Guid tenantId,
        Guid cycleId,
        Guid employeeId,
        string fullName,
        Guid approverEmployeeId,
        string approverName,
        bool isApproverOverridden = false,
        string? approverOverrideReason = null,
        string? employeeKey = null,
        string? email = null,
        Guid? orgUnitId = null,
        string? orgUnitName = null,
        string? jobTitle = null,
        Guid? managerId = null,
        string? managerName = null,
        DateTime? snapshotAt = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (cycleId == Guid.Empty)
            throw new ArgumentException("CycleId cannot be empty.", nameof(cycleId));
        if (employeeId == Guid.Empty)
            throw new ArgumentException("EmployeeId cannot be empty.", nameof(employeeId));
        if (approverEmployeeId == Guid.Empty)
            throw new ArgumentException("A resolved approver is required for a launched participant.", nameof(approverEmployeeId));

        return new PerformanceCycleParticipant
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            EmployeeId = employeeId,
            FullName = string.IsNullOrWhiteSpace(fullName) ? "(unknown)" : fullName.Trim(),
            ApproverEmployeeId = approverEmployeeId,
            ApproverName = string.IsNullOrWhiteSpace(approverName) ? "(unknown)" : approverName.Trim(),
            IsApproverOverridden = isApproverOverridden,
            ApproverOverrideReason = string.IsNullOrWhiteSpace(approverOverrideReason) ? null : approverOverrideReason.Trim(),
            EmployeeKey = employeeKey,
            Email = email,
            OrgUnitId = orgUnitId,
            OrgUnitName = orgUnitName,
            JobTitle = jobTitle,
            ManagerId = managerId,
            ManagerName = managerName,
            SnapshotAt = snapshotAt?.Kind switch
            {
                DateTimeKind.Utc => snapshotAt.Value,
                DateTimeKind.Local => snapshotAt.Value.ToUniversalTime(),
                DateTimeKind.Unspecified => DateTime.SpecifyKind(snapshotAt.Value, DateTimeKind.Utc),
                _ => DateTime.UtcNow
            }
        };
    }
}
