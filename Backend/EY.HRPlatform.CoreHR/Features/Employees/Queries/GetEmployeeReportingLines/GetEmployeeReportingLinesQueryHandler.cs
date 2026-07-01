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
        var employee = await LoadEmployeeAsync(request.EmployeeId, cancellationToken);
        if (employee is null)
        {
            return Result.Failure<EmployeeReportingLinesDto>(Error.NotFound("Employee", request.EmployeeId));
        }

        var managerChainEmployees = await BuildManagerChainAsync(employee, cancellationToken);
        var downlineEmployees = await BuildDownlineAsync(employee.Id, cancellationToken);
        var relevantEmployeeIds = new HashSet<Guid> { employee.Id };

        foreach (var manager in managerChainEmployees)
        {
            relevantEmployeeIds.Add(manager.Id);
        }

        foreach (var (downlineEmployee, _) in downlineEmployees)
        {
            relevantEmployeeIds.Add(downlineEmployee.Id);
        }

        var directReportCounts = await LoadDirectReportCountsAsync(relevantEmployeeIds, cancellationToken);
        var managerChain = managerChainEmployees
            .Select((manager, index) => MapNode(manager, settings, request.Audience, directReportCounts, index + 1))
            .ToList();
        var directReports = downlineEmployees
            .Where(node => node.Depth == 1)
            .Select(node => MapNode(node.Employee, settings, request.Audience, directReportCounts, node.Depth))
            .ToList();
        var downline = downlineEmployees
            .Select(node => MapNode(node.Employee, settings, request.Audience, directReportCounts, node.Depth))
            .ToList();

        return Result.Success(new EmployeeReportingLinesDto(
            MapListItem(employee, settings, request.Audience, directReportCounts),
            managerChain,
            directReports,
            downline,
            directReports.Count,
            downline.Count));
    }

    private async Task<List<Employee>> BuildManagerChainAsync(
        Employee employee,
        CancellationToken cancellationToken)
    {
        var managerChain = new List<Employee>();
        var visitedEmployeeIds = new HashSet<Guid> { employee.Id };
        var currentManagerId = employee.ManagerId;

        while (currentManagerId.HasValue && visitedEmployeeIds.Add(currentManagerId.Value))
        {
            var manager = await LoadEmployeeAsync(currentManagerId.Value, cancellationToken);
            if (manager is null)
            {
                break;
            }

            managerChain.Add(manager);
            currentManagerId = manager.ManagerId;
        }

        return managerChain;
    }

    private async Task<List<(Employee Employee, int Depth)>> BuildDownlineAsync(
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        var downline = new List<(Employee Employee, int Depth)>();
        var currentManagerIds = new List<Guid> { employeeId };
        var visitedEmployeeIds = new HashSet<Guid> { employeeId };
        var depth = 1;

        while (currentManagerIds.Count > 0)
        {
            var directReports = await dbContext.Employees
                .AsNoTracking()
                .Include(current => current.Manager)
                .Include(current => current.OrgUnit)
                .Where(current => current.ManagerId.HasValue && currentManagerIds.Contains(current.ManagerId.Value))
                .OrderBy(current => current.LastName)
                .ThenBy(current => current.FirstName)
                .ToListAsync(cancellationToken);

            if (directReports.Count == 0)
            {
                break;
            }

            var nextManagerIds = new List<Guid>();

            foreach (var directReport in directReports)
            {
                if (!visitedEmployeeIds.Add(directReport.Id))
                {
                    continue;
                }

                downline.Add((directReport, depth));
                nextManagerIds.Add(directReport.Id);
            }

            if (nextManagerIds.Count == 0)
            {
                break;
            }

            currentManagerIds = nextManagerIds;
            depth++;
        }

        return downline;
    }

    private async Task<Dictionary<Guid, int>> LoadDirectReportCountsAsync(
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken)
    {
        if (employeeIds.Count == 0)
        {
            return [];
        }

        return await dbContext.Employees
            .AsNoTracking()
            .Where(employee => employee.ManagerId.HasValue && employeeIds.Contains(employee.ManagerId.Value))
            .GroupBy(employee => employee.ManagerId!.Value)
            .Select(group => new { ManagerId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(group => group.ManagerId, group => group.Count, cancellationToken);
    }

    private Task<Employee?> LoadEmployeeAsync(
        Guid employeeId,
        CancellationToken cancellationToken)
        => dbContext.Employees
            .AsNoTracking()
            .Include(employee => employee.Manager)
            .Include(employee => employee.OrgUnit)
            .FirstOrDefaultAsync(employee => employee.Id == employeeId, cancellationToken);

    private EmployeeHierarchyNodeDto MapNode(
        Employee employee,
        TenantSettingsDto settings,
        EmployeeReadAudience audience,
        IReadOnlyDictionary<Guid, int> directReportCounts,
        int depth)
        => new(MapListItem(employee, settings, audience, directReportCounts), depth);

    private EmployeeListItemDto MapListItem(
        Employee employee,
        TenantSettingsDto settings,
        EmployeeReadAudience audience,
        IReadOnlyDictionary<Guid, int> directReportCounts)
        => employeeReadModelPolicy.MapListItem(
            employee,
            settings,
            audience,
            directReportCounts.GetValueOrDefault(employee.Id));
    }
