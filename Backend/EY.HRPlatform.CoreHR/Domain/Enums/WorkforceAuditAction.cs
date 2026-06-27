namespace EY.HRPlatform.CoreHR.Domain.Enums;

/// <summary>
/// Material workforce actions recorded in the append-only <c>WorkforceAuditEntry</c> log.
/// Deliberately focused (no generic audit framework): only actions that change canonical
/// workforce truth or org accountability are captured.
/// </summary>
public enum WorkforceAuditAction
{
    EmploymentStarted,
    EmploymentUpdated,
    EmploymentEnded,
    EmployeeRehired,
    WorkAssignmentCreated,
    WorkAssignmentChanged,
    ManagerChanged,
    EmployeeProfileUpdated,
    ImportPublished,
    ImportCorrectionPublished,
    ResponsibleManagerChanged
}
