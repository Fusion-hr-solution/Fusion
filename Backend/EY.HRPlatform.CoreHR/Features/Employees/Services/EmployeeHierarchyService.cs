using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Services;

public interface IEmployeeHierarchyService
{
    Task EnsureManagerAssignmentIsValidAsync(
        Guid employeeId,
        Guid? managerId,
        CancellationToken cancellationToken,
        IReadOnlyDictionary<Guid, Employee>? pendingEmployees = null);

    Task EnsureCanDeactivateAsync(Guid employeeId, CancellationToken cancellationToken);
}

public sealed class EmployeeHierarchyService(CoreHRDbContext dbContext) : IEmployeeHierarchyService
{
    public async Task EnsureManagerAssignmentIsValidAsync(
        Guid employeeId,
        Guid? managerId,
        CancellationToken cancellationToken,
        IReadOnlyDictionary<Guid, Employee>? pendingEmployees = null)
    {
        managerId = NormalizeManagerId(managerId);
        if (!managerId.HasValue)
        {
            return;
        }

        if (managerId.Value == employeeId)
        {
            throw new ArgumentException("An employee cannot be their own manager.", nameof(managerId));
        }

        var visitedEmployeeIds = new HashSet<Guid> { employeeId };
        var currentManagerId = managerId;

        while (currentManagerId.HasValue)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var resolvedManagerId = currentManagerId.Value;
            if (!visitedEmployeeIds.Add(resolvedManagerId))
            {
                throw new ArgumentException("Manager references cannot create a cycle.", nameof(managerId));
            }

            var manager = await ResolveEmployeeAsync(resolvedManagerId, pendingEmployees, cancellationToken)
                ?? throw new EntityNotFoundException("Manager", resolvedManagerId);

            currentManagerId = NormalizeManagerId(manager.ManagerId);
        }
    }

    public async Task EnsureCanDeactivateAsync(Guid employeeId, CancellationToken cancellationToken)
    {
        var hasActiveDirectReports = await dbContext.Employees
            .AsNoTracking()
            .AnyAsync(
                employee => employee.ManagerId == employeeId && employee.Status == EmployeeStatus.Active,
                cancellationToken);

        if (hasActiveDirectReports)
        {
            throw new ArgumentException(
                "Cannot deactivate an employee who still manages active direct reports. Reassign or clear their manager first.",
                nameof(employeeId));
        }
    }

    private async Task<EmployeeHierarchyNode?> ResolveEmployeeAsync(
        Guid employeeId,
        IReadOnlyDictionary<Guid, Employee>? pendingEmployees,
        CancellationToken cancellationToken)
    {
        if (pendingEmployees is not null
            && pendingEmployees.TryGetValue(employeeId, out var pendingEmployee))
        {
            return new EmployeeHierarchyNode(pendingEmployee.Id, NormalizeManagerId(pendingEmployee.ManagerId));
        }

        return await dbContext.Employees
            .AsNoTracking()
            .Where(employee => employee.Id == employeeId)
            .Select(employee => new EmployeeHierarchyNode(employee.Id, NormalizeManagerId(employee.ManagerId)))
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static Guid? NormalizeManagerId(Guid? managerId)
        => managerId == Guid.Empty ? null : managerId;

    private sealed record EmployeeHierarchyNode(Guid Id, Guid? ManagerId);
}