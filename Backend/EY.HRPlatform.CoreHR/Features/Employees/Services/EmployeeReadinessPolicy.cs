using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

namespace EY.HRPlatform.CoreHR.Features.Employees.Services;

internal static class EmployeeReadinessPolicy
{
    private sealed record ActionableRequiredField(
        string Key,
        string Label,
        string FixTargetKind,
        Func<Employee, bool> HasValue);

    private static readonly IReadOnlyList<ActionableRequiredField> ActionableRequiredFields =
    [
        new(
            "firstName",
            "First name is required",
            EmployeeReadinessFixTargetKinds.ProfileIdentity,
            employee => !string.IsNullOrWhiteSpace(employee.FirstName)),
        new(
            "lastName",
            "Last name is required",
            EmployeeReadinessFixTargetKinds.ProfileIdentity,
            employee => !string.IsNullOrWhiteSpace(employee.LastName)),
        new(
            "email",
            "Work email is required",
            EmployeeReadinessFixTargetKinds.ProfileIdentity,
            employee => !string.IsNullOrWhiteSpace(employee.Email)),
        new(
            "hireDate",
            "Hire date is required",
            EmployeeReadinessFixTargetKinds.ProfileEmployment,
            employee => employee.HireDate != default),
        new(
            "jobTitle",
            "Job title is required",
            EmployeeReadinessFixTargetKinds.ProfileEmployment,
            employee => !string.IsNullOrWhiteSpace(employee.JobTitle)),
        new(
            "phone",
            "Phone is required",
            EmployeeReadinessFixTargetKinds.ProfileIdentity,
            employee => !string.IsNullOrWhiteSpace(employee.Phone)),
        new(
            "workLocation",
            "Work location is required",
            EmployeeReadinessFixTargetKinds.ProfileEmployment,
            employee => !string.IsNullOrWhiteSpace(employee.WorkLocation)),
        new(
            "employmentType",
            "Employment type is required",
            EmployeeReadinessFixTargetKinds.ProfileEmployment,
            employee => !string.IsNullOrWhiteSpace(employee.EmploymentType))
    ];

    public static EmployeeReadinessSummaryDto BuildSummary(
        Employee employee,
        TenantSettingsDto settings,
        string hierarchyStatus,
        int directReportCount)
    {
        var employeeStateIssues = BuildEmployeeStateIssues(employee, settings, hierarchyStatus);
        var blockingIssues = BuildBlockingIssues(employee, directReportCount);

        return new EmployeeReadinessSummaryDto(
            employeeStateIssues.Count,
            blockingIssues.Count,
            employeeStateIssues,
            blockingIssues);
    }

    private static List<EmployeeReadinessIssueDto> BuildEmployeeStateIssues(
        Employee employee,
        TenantSettingsDto settings,
        string hierarchyStatus)
    {
        var issues = new List<EmployeeReadinessIssueDto>();

        foreach (var field in ActionableRequiredFields)
        {
            if (!IsFieldRequired(settings, field.Key) || field.HasValue(employee))
            {
                continue;
            }

            issues.Add(new EmployeeReadinessIssueDto(
                EmployeeReadinessIssueCodes.MissingRequiredField,
                field.Label,
                EmployeeReadinessIssueSeverities.Attention,
                field.Key,
                new EmployeeReadinessFixTargetDto(field.FixTargetKind, employee.Id, FieldKey: field.Key)));
        }

        if (!employee.OrgUnitId.HasValue)
        {
            issues.Add(new EmployeeReadinessIssueDto(
                EmployeeReadinessIssueCodes.MissingOrgUnit,
                "Org unit is missing",
                EmployeeReadinessIssueSeverities.Attention,
                "orgUnitId",
                new EmployeeReadinessFixTargetDto(
                    EmployeeReadinessFixTargetKinds.ProfileOrganization,
                    employee.Id,
                    FieldKey: "orgUnitId")));
        }

        switch (hierarchyStatus)
        {
            case EmployeeHierarchyStatuses.ManagerInactive:
                issues.Add(new EmployeeReadinessIssueDto(
                    EmployeeReadinessIssueCodes.ManagerInactive,
                    "Assigned manager is inactive",
                    EmployeeReadinessIssueSeverities.Attention,
                    "managerId",
                    new EmployeeReadinessFixTargetDto(
                        EmployeeReadinessFixTargetKinds.ReportingRelationships,
                        employee.Id,
                        FieldKey: "managerId")));
                break;
            case EmployeeHierarchyStatuses.ManagerMissing:
                issues.Add(new EmployeeReadinessIssueDto(
                    EmployeeReadinessIssueCodes.ManagerMissing,
                    "Manager record is missing",
                    EmployeeReadinessIssueSeverities.Attention,
                    "managerId",
                    new EmployeeReadinessFixTargetDto(
                        EmployeeReadinessFixTargetKinds.ReportingRelationships,
                        employee.Id,
                        FieldKey: "managerId")));
                break;
        }

        return issues;
    }

    private static List<EmployeeReadinessIssueDto> BuildBlockingIssues(Employee employee, int directReportCount)
    {
        if (employee.Status != EmployeeStatus.Active || directReportCount <= 0)
        {
            return [];
        }

        return
        [
            new EmployeeReadinessIssueDto(
                EmployeeReadinessIssueCodes.DeactivationBlocked,
                directReportCount == 1
                    ? "Employee cannot be deactivated while 1 active direct report remains"
                    : $"Employee cannot be deactivated while {directReportCount} active direct reports remain",
                EmployeeReadinessIssueSeverities.Blocker,
                null,
                new EmployeeReadinessFixTargetDto(EmployeeReadinessFixTargetKinds.ProfileStatus, employee.Id))
        ];
    }

    private static bool IsFieldRequired(TenantSettingsDto settings, string fieldKey)
        => settings.EmployeeFieldConfig.TryGetValue(fieldKey, out var fieldConfig)
            ? fieldConfig.Required
            : false;
}
