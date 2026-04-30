using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeReportingLines;

public sealed class GetEmployeeReportingLinesQueryHandler(
    CoreHRDbContext dbContext,
    IEmployeeReadModelPolicy employeeReadModelPolicy,
    ITenantSettingsReadService tenantSettingsReadService) : IQueryHandler<GetEmployeeReportingLinesQuery, Result<EmployeeReportingLinesDto>>
{
    private readonly IEmployeeReadModelPolicy employeeReadModelPolicy = employeeReadModelPolicy;

    public async Task<Result<EmployeeReportingLinesDto>> Handle(
        GetEmployeeReportingLinesQuery request,
        CancellationToken cancellationToken)
    {
        var settings = await tenantSettingsReadService.GetCurrentAsync(cancellationToken);
        var employees = await dbContext.Employees
            .AsNoTracking()
            .Include(employee => employee.Manager)
            .Include(employee => employee.OrgUnit)
            .ToListAsync(cancellationToken);

        var employeeById = employees.ToDictionary(employee => employee.Id);
        if (!employeeById.TryGetValue(request.EmployeeId, out var employee))
        {
            return Result.Failure<EmployeeReportingLinesDto>(Error.NotFound("Employee", request.EmployeeId));
        }

        var directReportsLookup = employees
            .Where(current => current.ManagerId.HasValue)
            .GroupBy(current => current.ManagerId!.Value)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderBy(current => current.LastName)
                    .ThenBy(current => current.FirstName)
                    .ToList());
        var directReportCounts = directReportsLookup
            .ToDictionary(group => group.Key, group => group.Value.Count);

        var managerChain = BuildManagerChain(employee, employeeById, settings, directReportCounts);
        var directReports = directReportsLookup
            .GetValueOrDefault(employee.Id, [])
            .Select(current => MapNode(current, settings, directReportCounts, depth: 1))
            .ToList();
        var downline = BuildDownline(employee.Id, directReportsLookup, settings, directReportCounts);

        return Result.Success(new EmployeeReportingLinesDto(
            MapListItem(employee, settings, directReportCounts),
            managerChain,
            directReports,
            downline,
            directReports.Count,
            downline.Count));
    }

    private List<EmployeeHierarchyNodeDto> BuildManagerChain(
        Employee employee,
        IReadOnlyDictionary<Guid, Employee> employeeById,
        TenantSettingsDto settings,
        IReadOnlyDictionary<Guid, int> directReportCounts)
    {
        var managerChain = new List<EmployeeHierarchyNodeDto>();
        var visitedEmployeeIds = new HashSet<Guid> { employee.Id };
        var currentManagerId = employee.ManagerId;
        var depth = 1;

        while (currentManagerId.HasValue
            && employeeById.TryGetValue(currentManagerId.Value, out var manager)
            && visitedEmployeeIds.Add(manager.Id))
        {
            managerChain.Add(MapNode(manager, settings, directReportCounts, depth));
            currentManagerId = manager.ManagerId;
            depth++;
        }

        return managerChain;
    }

    private List<EmployeeHierarchyNodeDto> BuildDownline(
        Guid employeeId,
        IReadOnlyDictionary<Guid, List<Employee>> directReportsLookup,
        TenantSettingsDto settings,
        IReadOnlyDictionary<Guid, int> directReportCounts)
    {
        var downline = new List<EmployeeHierarchyNodeDto>();
        var queue = new Queue<(Employee Employee, int Depth)>();
        var visitedEmployeeIds = new HashSet<Guid> { employeeId };

        foreach (var directReport in directReportsLookup.GetValueOrDefault(employeeId, []))
        {
            queue.Enqueue((directReport, 1));
        }

        while (queue.Count > 0)
        {
            var (employee, depth) = queue.Dequeue();
            if (!visitedEmployeeIds.Add(employee.Id))
            {
                continue;
            }

            downline.Add(MapNode(employee, settings, directReportCounts, depth));

            foreach (var report in directReportsLookup.GetValueOrDefault(employee.Id, []))
            {
                queue.Enqueue((report, depth + 1));
            }
        }

        return downline;
    }

    private EmployeeHierarchyNodeDto MapNode(
        Employee employee,
        TenantSettingsDto settings,
        IReadOnlyDictionary<Guid, int> directReportCounts,
        int depth)
        => new(MapListItem(employee, settings, directReportCounts), depth);

    private EmployeeListItemDto MapListItem(
        Employee employee,
        TenantSettingsDto settings,
        IReadOnlyDictionary<Guid, int> directReportCounts)
        => employeeReadModelPolicy
            .MapListItem(employee, settings, EmployeeReadAudience.HrAdmin)
            with
            {
                DirectReportCount = directReportCounts.GetValueOrDefault(employee.Id)
            };
}