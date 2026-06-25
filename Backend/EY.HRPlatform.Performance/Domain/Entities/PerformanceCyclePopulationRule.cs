using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A single rule contributing to a cycle's population selection. Rules are resolved against
/// Core workforce data at preview/publish time; they describe intent, not frozen membership.
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

    public static PerformanceCyclePopulationRule Create(
        Guid tenantId,
        PopulationRuleType ruleType,
        Guid refId,
        bool includeDescendants = false)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (refId == Guid.Empty)
            throw new ArgumentException("Population rule reference id cannot be empty.", nameof(refId));

        return new PerformanceCyclePopulationRule
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RuleType = ruleType,
            RefId = refId,
            IncludeDescendants = ruleType == PopulationRuleType.OrgUnit && includeDescendants
        };
    }
}
