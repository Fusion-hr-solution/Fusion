using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A draft-side approver override for a single participant employee: HR chooses a Core
/// employee (other than the default primary manager) to approve that participant's objectives,
/// with a reason. Editable only while the campaign is a Draft; the resolved approver is frozen
/// onto the participant baseline at launch.
/// </summary>
public class PerformanceCycleApproverOverride : BaseEntity, ITenantEntity
{
    private PerformanceCycleApproverOverride() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }

    /// <summary>The included participant (Core employee id) whose approver is overridden.</summary>
    public Guid ParticipantEmployeeId { get; private set; }

    /// <summary>The overridden approver (Core employee id).</summary>
    public Guid ApproverEmployeeId { get; private set; }
    public string ApproverName { get; private set; } = string.Empty;
    public string Reason { get; private set; } = string.Empty;

    public static PerformanceCycleApproverOverride Create(
        Guid tenantId,
        Guid cycleId,
        Guid participantEmployeeId,
        Guid approverEmployeeId,
        string approverName,
        string reason)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (cycleId == Guid.Empty)
            throw new ArgumentException("CycleId cannot be empty.", nameof(cycleId));
        if (participantEmployeeId == Guid.Empty)
            throw new ArgumentException("ParticipantEmployeeId cannot be empty.", nameof(participantEmployeeId));

        var over = new PerformanceCycleApproverOverride
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            ParticipantEmployeeId = participantEmployeeId
        };
        over.Apply(approverEmployeeId, approverName, reason);
        return over;
    }

    public void Update(Guid approverEmployeeId, string approverName, string reason)
        => Apply(approverEmployeeId, approverName, reason);

    private void Apply(Guid approverEmployeeId, string approverName, string reason)
    {
        if (approverEmployeeId == Guid.Empty)
            throw new ArgumentException("An approver is required.", nameof(approverEmployeeId));
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("An override reason is required.", nameof(reason));

        ApproverEmployeeId = approverEmployeeId;
        ApproverName = string.IsNullOrWhiteSpace(approverName) ? "(unknown)" : approverName.Trim();
        Reason = reason.Trim();
        UpdatedAt = DateTime.UtcNow;
    }
}
