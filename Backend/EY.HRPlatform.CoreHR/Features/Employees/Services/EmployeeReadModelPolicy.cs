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
            employee.StableEmployeeKey,
            employee.EmployeeNumber,
            employee.FirstName,
            employee.LastName,
            employee.PreferredName,
            employee.Email,
            CanViewField(settings, "phone", audience) ? employee.Phone : null,
            employee.OrgUnitId,
            employee.OrgUnit?.Name,
            CanViewField(settings, "jobTitle", audience) ? employee.JobTitle : null,
            CanViewField(settings, "workLocation", audience) ? employee.WorkLocation : null,
            CanViewField(settings, "employmentType", audience) ? employee.EmploymentType : null,
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
    {
        var hierarchyStatus = ResolveHierarchyStatus(employee, directReportCount);

        return new EmployeeListItemDto(
            employee.Id,
            employee.StableEmployeeKey,
            employee.EmployeeNumber,
            employee.FirstName,
            employee.LastName,
            employee.PreferredName,
            employee.Email,
            employee.OrgUnitId,
            employee.OrgUnit?.Name,
            CanViewField(settings, "jobTitle", audience) ? employee.JobTitle : null,
            employee.Status,
            employee.HireDate,
            employee.ManagerId,
            employee.Manager is not null ? employee.Manager.FirstName + " " + employee.Manager.LastName : null,
            hierarchyStatus,
            directReportCount,
            employee.Version)
        {
            Readiness = EmployeeReadinessPolicy.BuildSummary(employee, settings, hierarchyStatus, directReportCount)
        };
    }

    public EmployeeProfileDto MapProfile(Employee employee, TenantSettingsDto settings, EmployeeReadAudience audience, int directReportCount)
    {
        var hierarchyStatus = ResolveHierarchyStatus(employee, directReportCount);

        return new EmployeeProfileDto(
            employee.Id,
            employee.StableEmployeeKey,
            employee.EmployeeNumber,
            employee.FirstName,
            employee.LastName,
            employee.PreferredName,
            employee.Email,
            CanViewField(settings, "phone", audience) ? employee.Phone : null,
            CanViewField(settings, "jobTitle", audience) ? employee.JobTitle : null,
            CanViewField(settings, "workLocation", audience) ? employee.WorkLocation : null,
            CanViewField(settings, "employmentType", audience) ? employee.EmploymentType : null,
            employee.HireDate,
            employee.Status,
            employee.OrgUnitId,
            employee.OrgUnit?.Name,
            employee.OrgUnit?.Type,
            employee.ManagerId,
            employee.Manager?.FirstName,
            employee.Manager?.LastName,
            employee.Manager?.Email,
            hierarchyStatus,
            directReportCount,
            employee.CreatedAt,
            employee.UpdatedAt,
            employee.Version)
        {
            Readiness = EmployeeReadinessPolicy.BuildSummary(employee, settings, hierarchyStatus, directReportCount)
        };
    }

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
