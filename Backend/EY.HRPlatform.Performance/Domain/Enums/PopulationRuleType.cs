namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>
/// How a population rule contributes to the resolved participant set.
/// </summary>
public enum PopulationRuleType
{
    /// <summary>Include all employees in an org unit (optionally its descendants).</summary>
    OrgUnit,

    /// <summary>Explicitly include a single employee.</summary>
    IncludeEmployee,

    /// <summary>Explicitly exclude a single employee from the resolved set.</summary>
    ExcludeEmployee
}
