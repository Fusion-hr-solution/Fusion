namespace EY.HRPlatform.CoreHR.Features.Employees.Dtos;

public enum EmployeeReadinessFilter
{
    Ready,
    NeedsAttention,
    MissingRequiredField,
    MissingOrgUnit,
    ReportingIssue,
    NoManagerAssigned,
    ManagerInactive,
    ManagerMissing,
    DeactivationBlocked
}
