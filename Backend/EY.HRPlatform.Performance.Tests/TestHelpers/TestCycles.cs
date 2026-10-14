using EY.HRPlatform.Performance.Domain.Cycles;

namespace EY.HRPlatform.Performance.Tests.TestHelpers;

/// <summary>Moves an arranged Draft Cycle into the Active state employee planning requires.</summary>
public static class TestCycles
{
    public static PerformanceCycle Activated(this PerformanceCycle cycle)
    {
        cycle.Activate(ActivationSnapshot.Capture(
            cycle.TenantId, cycle.Id, cycle.Name, cycle.StartDate, cycle.EndDate, cycle.PlanningDeadline,
            cycle.StartDate, 0, "{}", "{}", "[]", "[]"));
        return cycle;
    }
}
