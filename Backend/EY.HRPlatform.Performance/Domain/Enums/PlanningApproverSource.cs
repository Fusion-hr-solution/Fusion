namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>How the planning approver was resolved for a participant snapshot.</summary>
public enum PlanningApproverSource
{
    Unresolved,
    DirectManager,
    EscalatedManager,
    ManualAssignment
}
