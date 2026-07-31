using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A single rule contributing to a cycle's population selection. Rules are resolved against
/// Core workforce data at preview/launch time; they describe intent, not frozen membership.
/// </summary>
public class PerformanceCyclePopulationRule : BaseEntity, ITenantEntity
{
    private PerformanceCyclePopulationRule() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public PopulationRuleType RuleType { get; private set; }

    /// <summary>Org unit id (for OrgUnit) or employee id (for IncludeEmployee/ExcludeEmployee).</summary>
    public Guid RefId { get; private set; }

    /// <summary>For OrgUnit rules: whether to include employees in descendant org units.</summary>
    public bool IncludeDescendants { get; private set; }

    /// <summary>For ExcludeEmployee rules: the required reason the employee is excluded.</summary>
    public string? Reason { get; private set; }

    public static PerformanceCyclePopulationRule Create(
        Guid tenantId,
        PopulationRuleType ruleType,
        Guid refId,
        bool includeDescendants = false,
        string? reason = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (refId == Guid.Empty)
            throw new ArgumentException("Population rule reference id cannot be empty.", nameof(refId));

        var normalizedReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        if (ruleType == PopulationRuleType.ExcludeEmployee && normalizedReason is null)
            throw new ArgumentException("An exclusion requires a reason.", nameof(reason));

        return new PerformanceCyclePopulationRule
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RuleType = ruleType,
            RefId = refId,
            IncludeDescendants = ruleType == PopulationRuleType.OrgUnit && includeDescendants,
            Reason = ruleType == PopulationRuleType.ExcludeEmployee ? normalizedReason : null
        };
    }
}
