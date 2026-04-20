namespace EY.HRPlatform.CoreHR.Domain.Entities;

public enum TenantSetupPhase
{
    NotStarted = 0,
    Activated = 1,
    StructurallyGoverned = 2,
    StructurallyPublished = 3,
    Operational = 4
}