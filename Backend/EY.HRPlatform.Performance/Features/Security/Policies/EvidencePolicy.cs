using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;

namespace EY.HRPlatform.Performance.Features.Security.Policies;

public static class EvidencePolicy
{
    public static bool CanRead(CycleViewer viewer, Objective objective, EmployeePlan? plan)
        => ObjectivePolicy.CanReadProgressHistory(viewer, objective, plan);
}
