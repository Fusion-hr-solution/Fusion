using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

namespace EY.HRPlatform.CoreHR.Features.Employees.Services;

public enum EmployeeReadAudience
{
    HrAdmin,
    Manager,
    Employee
}

public interface IEmployeeReadModelPolicy
{
    EmployeeDto MapDetail(Employee employee, TenantSettingsDto settings, EmployeeReadAudience audience);

    EmployeeListItemDto MapListItem(Employee employee, TenantSettingsDto settings, EmployeeReadAudience audience, int directReportCount = 0);

    EmployeeProfileDto MapProfile(Employee employee, TenantSettingsDto settings, EmployeeReadAudience audience, int directReportCount);
}

public sealed class EmployeeReadModelPolicy : IEmployeeReadModelPolicy
{
    public EmployeeDto MapDetail(Employee employee, TenantSettingsDto settings, EmployeeReadAudience audience)
        => new(
            employee.Id,
            employee.TenantId,
            employee.FirstName,
            employee.LastName,
            employee.Email,
            employee.OrgUnitId,
            employee.OrgUnit?.Name,
            CanViewField(settings, "jobTitle", audience) ? employee.JobTitle : null,
            employee.HireDate,
            employee.Status,
            employee.ManagerId,
            employee.Manager is not null
                ? new ManagerDto(employee.Manager.Id, employee.Manager.FirstName, employee.Manager.LastName, employee.Manager.Email)
                : null,
            employee.CreatedAt,
            employee.UpdatedAt,
            employee.Version);

    public EmployeeListItemDto MapListItem(Employee employee, TenantSettingsDto settings, EmployeeReadAudience audience, int directReportCount = 0)
        => new(
            employee.Id,
            employee.FirstName,
            employee.LastName,
            employee.Email,
            employee.OrgUnitId,
            employee.OrgUnit?.Name,
            CanViewField(settings, "jobTitle", audience) ? employee.JobTitle : null,
            employee.Status,
            employee.HireDate,
            employee.ManagerId,
            employee.Manager is not null ? employee.Manager.FirstName + " " + employee.Manager.LastName : null,
            ResolveHierarchyStatus(employee, directReportCount),
            directReportCount,
            employee.Version)
        {
            Readiness = EmployeeReadinessPolicy.BuildSummary(employee, settings, ResolveHierarchyStatus(employee, directReportCount), directReportCount)
        };

    public EmployeeProfileDto MapProfile(Employee employee, TenantSettingsDto settings, EmployeeReadAudience audience, int directReportCount)
        => new(
            employee.Id,
            employee.FirstName,
            employee.LastName,
            employee.PreferredName,
            employee.Email,
            CanViewField(settings, "jobTitle", audience) ? employee.JobTitle : null,
            employee.HireDate,
            employee.Status,
            employee.OrgUnitId,
            employee.OrgUnit?.Name,
            employee.ManagerId,
            employee.Manager?.FirstName,
            employee.Manager?.LastName,
            employee.Manager?.Email,
            ResolveHierarchyStatus(employee, directReportCount),
            directReportCount,
            employee.Version)
        {
            Readiness = EmployeeReadinessPolicy.BuildSummary(employee, settings, ResolveHierarchyStatus(employee, directReportCount), directReportCount)
        };

    private static bool CanViewField(
        TenantSettingsDto settings,
        string fieldName,
        EmployeeReadAudience audience)
    {
        if (!settings.EmployeeFieldConfig.TryGetValue(fieldName, out var fieldConfig))
        {
            return true;
        }

        return audience switch
        {
            EmployeeReadAudience.HrAdmin => fieldConfig.Visible,
            EmployeeReadAudience.Manager => fieldConfig.Visible && fieldConfig.VisibleToManager,
            EmployeeReadAudience.Employee => fieldConfig.Visible && fieldConfig.VisibleToEmployee,
            _ => false,
        };
    }

    internal static string ResolveHierarchyStatus(Employee employee, int directReportCount)
    {
        if (!employee.ManagerId.HasValue)
        {
            return directReportCount > 0
                ? EmployeeHierarchyStatuses.Root
                : EmployeeHierarchyStatuses.NoManagerAssigned;
        }

        if (employee.Manager is null)
        {
            return EmployeeHierarchyStatuses.ManagerMissing;
        }

        return employee.Manager.Status == Domain.Enums.EmployeeStatus.Active
            ? EmployeeHierarchyStatuses.Healthy
            : EmployeeHierarchyStatuses.ManagerInactive;
    }
}
