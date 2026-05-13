using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetWorkforceReadinessSummary;

public sealed class GetWorkforceReadinessSummaryQueryHandler(
    CoreHRDbContext dbContext,
    ITenantSettingsReadService tenantSettingsReadService) : IQueryHandler<GetWorkforceReadinessSummaryQuery, Result<WorkforceReadinessSummaryDto>>
{
    public async Task<Result<WorkforceReadinessSummaryDto>> Handle(
        GetWorkforceReadinessSummaryQuery request,
        CancellationToken cancellationToken)
    {
        var settings = await tenantSettingsReadService.GetCurrentAsync(cancellationToken);
        var activeEmployees = await dbContext.Employees
            .AsNoTracking()
            .Include(employee => employee.Manager)
            .Include(employee => employee.OrgUnit)
            .Where(employee => employee.Status == EmployeeStatus.Active)
            .ToListAsync(cancellationToken);

        var activeEmployeeIds = activeEmployees
            .Select(employee => employee.Id)
            .ToList();

        var activeDirectReportCounts = activeEmployeeIds.Count == 0
            ? new Dictionary<Guid, int>()
            : await dbContext.Employees
                .AsNoTracking()
                .Where(employee => employee.ManagerId.HasValue
                    && employee.Status == EmployeeStatus.Active
                    && activeEmployeeIds.Contains(employee.ManagerId.Value))
                .GroupBy(employee => employee.ManagerId!.Value)
                .Select(group => new { ManagerId = group.Key, Count = group.Count() })
                .ToDictionaryAsync(group => group.ManagerId, group => group.Count, cancellationToken);

        var readinessByEmployeeId = BuildReadinessSummaries(activeEmployees, activeDirectReportCounts, settings);
        var readinessSummaries = readinessByEmployeeId.Values.ToList();
        var activeEmployeeCount = activeEmployees.Count;
        var readyEmployeeCount = readinessSummaries.Count(summary => summary.EmployeeStateIssueCount == 0);
        var employeesNeedingAttention = readinessSummaries.Count(summary => summary.EmployeeStateIssueCount > 0);
        var unresolvedImportIssueCount = await CountUnresolvedImportIssuesAsync(settings, cancellationToken);

        return Result.Success(new WorkforceReadinessSummaryDto(
            activeEmployeeCount,
            readyEmployeeCount,
            employeesNeedingAttention,
            activeEmployeeCount == 0
                ? 100m
                : Math.Round(readyEmployeeCount * 100m / activeEmployeeCount, 1, MidpointRounding.AwayFromZero),
            new WorkforceReadinessIssueCountsDto(
                readinessSummaries.Count(summary => summary.EmployeeStateIssues.Any(issue => issue.Code == EmployeeReadinessIssueCodes.MissingRequiredField)),
                readinessSummaries.Count(summary => summary.EmployeeStateIssues.Any(issue => issue.Code == EmployeeReadinessIssueCodes.MissingOrgUnit)),
                readinessSummaries.Count(summary => summary.EmployeeStateIssues.Any(issue => issue.Code == EmployeeReadinessIssueCodes.NoManagerAssigned)),
                readinessSummaries.Count(summary => summary.EmployeeStateIssues.Any(issue => issue.Code == EmployeeReadinessIssueCodes.ManagerInactive)),
                readinessSummaries.Count(summary => summary.EmployeeStateIssues.Any(issue => issue.Code == EmployeeReadinessIssueCodes.ManagerMissing)),
                readinessSummaries.Count(summary => summary.BlockingIssues.Any(issue => issue.Code == EmployeeReadinessIssueCodes.DeactivationBlocked)),
                unresolvedImportIssueCount)));
    }

    private async Task<int> CountUnresolvedImportIssuesAsync(
        TenantSettingsDto settings,
        CancellationToken cancellationToken)
    {
        var storedIssues = await dbContext.EmployeeImportFollowUpIssues
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        if (storedIssues.Count == 0)
        {
            return 0;
        }

        var employeeIds = storedIssues
            .Select(issue => issue.EmployeeId)
            .Distinct()
            .ToList();

        var employees = await dbContext.Employees
            .AsNoTracking()
            .Include(employee => employee.Manager)
            .Include(employee => employee.OrgUnit)
            .Where(employee => employeeIds.Contains(employee.Id))
            .ToListAsync(cancellationToken);

        if (employees.Count == 0)
        {
            return 0;
        }

        var activeDirectReportCounts = await dbContext.Employees
            .AsNoTracking()
            .Where(employee => employee.ManagerId.HasValue
                && employee.Status == EmployeeStatus.Active
                && employeeIds.Contains(employee.ManagerId.Value))
            .GroupBy(employee => employee.ManagerId!.Value)
            .Select(group => new { ManagerId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(group => group.ManagerId, group => group.Count, cancellationToken);

        var readinessByEmployeeId = BuildReadinessSummaries(employees, activeDirectReportCounts, settings);

        return storedIssues.Count(storedIssue =>
            readinessByEmployeeId.TryGetValue(storedIssue.EmployeeId, out var summary)
            && summary.EmployeeStateIssues.Any(issue =>
                issue.Code == storedIssue.IssueCode
                && string.Equals(issue.FieldKey, storedIssue.FieldKey, StringComparison.Ordinal)));
    }

    private static Dictionary<Guid, EmployeeReadinessSummaryDto> BuildReadinessSummaries(
        IReadOnlyCollection<Employee> employees,
        IReadOnlyDictionary<Guid, int> directReportCounts,
        TenantSettingsDto settings)
        => employees.ToDictionary(
            employee => employee.Id,
            employee =>
            {
                var directReportCount = directReportCounts.GetValueOrDefault(employee.Id);
                var hierarchyStatus = EmployeeReadModelPolicy.ResolveHierarchyStatus(employee, directReportCount);
                return EmployeeReadinessPolicy.BuildSummary(employee, settings, hierarchyStatus, directReportCount);
            });
}