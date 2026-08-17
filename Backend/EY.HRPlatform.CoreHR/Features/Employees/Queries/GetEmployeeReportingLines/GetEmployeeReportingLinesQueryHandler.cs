using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeReportingLines;

public sealed class GetEmployeeReportingLinesQueryHandler(
    CoreHRDbContext dbContext,
    IEmployeeDetailsReadModelService employeeDetailsReadModelService,
    IWorkforceCanonicalResolver workforceCanonicalResolver) : IQueryHandler<GetEmployeeReportingLinesQuery, Result<EmployeeReportingLinesDto>>
{
    public async Task<Result<EmployeeReportingLinesDto>> Handle(
        GetEmployeeReportingLinesQuery request,
        CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(current => current.Id == request.EmployeeId, cancellationToken);

        if (employee is null)
        {
            return Result.Failure<EmployeeReportingLinesDto>(Error.NotFound("Employee", request.EmployeeId));
        }

        var at = DateTime.UtcNow;
        var managerChainIds = (await workforceCanonicalResolver.GetManagerChainAsync(employee.Id, at, 50, cancellationToken)).ToList();

        var downline = await BuildDownlineAsync(employee.Id, at, cancellationToken);
        var relevantEmployeeIds = managerChainIds
            .Concat(downline.Select(x => x.EmployeeId))
            .Append(employee.Id)
            .Distinct()
            .ToList();

        var employeesById = await dbContext.Employees
            .AsNoTracking()
            .Where(current => relevantEmployeeIds.Contains(current.Id))
            .ToDictionaryAsync(current => current.Id, cancellationToken);

        var employeeItem = await employeeDetailsReadModelService.BuildListItemAsync(employee, request.Audience, at, cancellationToken);
        var managerChain = new List<EmployeeHierarchyNodeDto>();
        foreach (var managerId in managerChainIds)
        {
            if (!employeesById.TryGetValue(managerId, out var manager))
            {
                continue;
            }

            var managerItem = await employeeDetailsReadModelService.BuildListItemAsync(manager, request.Audience, at, cancellationToken);
            managerChain.Add(new EmployeeHierarchyNodeDto(managerItem, managerChain.Count + 1));
        }

        var directReports = new List<EmployeeHierarchyNodeDto>();
        var downlineNodes = new List<EmployeeHierarchyNodeDto>();
        foreach (var node in downline)
        {
            if (!employeesById.TryGetValue(node.EmployeeId, out var downlineEmployee))
            {
                continue;
            }

            var item = await employeeDetailsReadModelService.BuildListItemAsync(downlineEmployee, request.Audience, at, cancellationToken);
            var hierarchyNode = new EmployeeHierarchyNodeDto(item, node.Depth);
            downlineNodes.Add(hierarchyNode);

            if (node.Depth == 1)
            {
                directReports.Add(hierarchyNode);
            }
        }

        return Result.Success(new EmployeeReportingLinesDto(
            employeeItem,
            managerChain,
            directReports,
            downlineNodes,
            directReports.Count,
            downlineNodes.Count));
    }

    private async Task<List<(Guid EmployeeId, int Depth)>> BuildDownlineAsync(
        Guid employeeId,
        DateTime asOf,
        CancellationToken cancellationToken)
    {
        var activeRelationships = await dbContext.ManagerRelationships
            .AsNoTracking()
            .Where(current => current.Type == ReportingRelationshipType.PrimaryManager
                && current.EffectiveFrom <= asOf
                && (current.EffectiveTo == null || asOf < current.EffectiveTo))
            .Select(current => new { current.SubjectEmployeeId, current.ManagerEmployeeId })
            .ToListAsync(cancellationToken);

        var reportsByManager = activeRelationships.ToLookup(current => current.ManagerEmployeeId, current => current.SubjectEmployeeId);
        var visited = new HashSet<Guid> { employeeId };
        var currentManagerIds = new List<Guid> { employeeId };
        var depth = 1;
        var downline = new List<(Guid EmployeeId, int Depth)>();

        while (currentManagerIds.Count > 0)
        {
            var nextManagerIds = new List<Guid>();
            foreach (var managerId in currentManagerIds)
            {
                foreach (var directReportId in reportsByManager[managerId])
                {
                    if (!visited.Add(directReportId))
                    {
                        continue;
                    }

                    downline.Add((directReportId, depth));
                    nextManagerIds.Add(directReportId);
                }
            }

            currentManagerIds = nextManagerIds;
            depth++;
        }

        return downline;
    }
}
