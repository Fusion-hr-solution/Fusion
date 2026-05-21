namespace EY.HRPlatform.CoreHR.Features.Employees.Dtos;

public enum EmployeeReadinessFilter
{
    NeedsAttention,
    MissingRequiredField,
    MissingOrgUnit,
    NoManagerAssigned,
    ManagerInactive,
    ManagerMissing,
    DeactivationBlocked
}