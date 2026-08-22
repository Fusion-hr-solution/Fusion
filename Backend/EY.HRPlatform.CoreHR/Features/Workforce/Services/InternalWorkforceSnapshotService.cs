using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Workforce.Dtos;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Workforce.Services;

public interface IInternalWorkforceSnapshotService
{
    Task<IReadOnlyList<InternalWorkforceEmployeeSnapshotDto>> ResolveEmployeesAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<InternalWorkforceEmployeeSnapshotDto>> GetEmployeesByScopeAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> orgUnitIds,
        bool includeDescendants,
        bool includeInactive,
        CancellationToken cancellationToken);

    /// <summary>
    /// All active/eligible employees for the tenant as-of a date: those with active employment
    /// and an active primary assignment on that date. Additive convenience so Performance can
    /// resolve an "all eligible active" population entirely through the snapshot contract.
    /// </summary>
    Task<IReadOnlyList<InternalWorkforceEmployeeSnapshotDto>> GetAllActiveAsOfAsync(
        DateTime asOf,
        bool includeInactive,
        CancellationToken cancellationToken);
}

public sealed class InternalWorkforceSnapshotService(CoreHRDbContext dbContext) : IInternalWorkforceSnapshotService
{
    public async Task<IReadOnlyList<InternalWorkforceEmployeeSnapshotDto>> ResolveEmployeesAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken)
    {
        if (employeeIds.Count == 0)
        {
            return [];
        }

        return await BuildSnapshotsAsync(Normalize(asOf), employeeIds, cancellationToken);
    }

    public async Task<IReadOnlyList<InternalWorkforceEmployeeSnapshotDto>> GetEmployeesByScopeAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> orgUnitIds,
        bool includeDescendants,
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        if (orgUnitIds.Count == 0)
        {
            return [];
        }

        var at = Normalize(asOf);
        var targetOrgUnitIds = await ResolveOrgUnitScopeAsync(orgUnitIds, includeDescendants, cancellationToken);
        if (targetOrgUnitIds.Count == 0)
        {
            return [];
        }

        var activeEmploymentIds = dbContext.Employments
            .AsNoTracking()
            .Where(e => e.Status == EmploymentStatus.Active
                && e.EffectiveFrom <= at
                && (e.EffectiveTo == null || at < e.EffectiveTo))
            .Select(e => e.Id);

        var employeeIds = await dbContext.WorkAssignments
            .AsNoTracking()
            .Where(w => targetOrgUnitIds.Contains(w.OrgUnitId)
                && w.IsPrimary
                && activeEmploymentIds.Contains(w.EmploymentId)
                && w.EffectiveFrom <= at
                && (w.EffectiveTo == null || at < w.EffectiveTo))
            .Select(w => w.EmployeeId)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (employeeIds.Count == 0)
        {
            return [];
        }

        var snapshots = await BuildSnapshotsAsync(at, employeeIds, cancellationToken);
        return includeInactive
            ? snapshots
            : snapshots.Where(snapshot => snapshot.IsActive).ToList();
    }

    public async Task<IReadOnlyList<InternalWorkforceEmployeeSnapshotDto>> GetAllActiveAsOfAsync(
        DateTime asOf,
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        var at = Normalize(asOf);

        // Eligible = active employment AND an active primary assignment on the as-of date.
        // Resolved through the same tenant-filtered machinery as by-scope; the query filter
        // scopes every set to the caller's tenant, so no cross-tenant workforce leaks.
        var activeEmploymentIds = dbContext.Employments
            .AsNoTracking()
            .Where(e => e.Status == EmploymentStatus.Active
                && e.EffectiveFrom <= at
                && (e.EffectiveTo == null || at < e.EffectiveTo))
            .Select(e => e.Id);

        var employeeIds = await dbContext.WorkAssignments
            .AsNoTracking()
            .Where(w => w.IsPrimary
                && activeEmploymentIds.Contains(w.EmploymentId)
                && w.EffectiveFrom <= at
                && (w.EffectiveTo == null || at < w.EffectiveTo))
            .Select(w => w.EmployeeId)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (employeeIds.Count == 0)
        {
            return [];
        }

        var snapshots = await BuildSnapshotsAsync(at, employeeIds, cancellationToken);
        return includeInactive
            ? snapshots
            : snapshots.Where(snapshot => snapshot.IsActive).ToList();
    }

    private async Task<IReadOnlyList<InternalWorkforceEmployeeSnapshotDto>> BuildSnapshotsAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken)
    {
        var employees = await dbContext.Employees
            .AsNoTracking()
            .Where(employee => employeeIds.Contains(employee.Id))
            .OrderBy(employee => employee.LastName)
            .ThenBy(employee => employee.FirstName)
            .ToListAsync(cancellationToken);

        if (employees.Count == 0)
        {
            return [];
        }

        var activeEmployeeIds = (await dbContext.Employments
                .AsNoTracking()
                .Where(employment => employeeIds.Contains(employment.EmployeeId)
                    && employment.Status == EmploymentStatus.Active
                    && employment.EffectiveFrom <= asOf
                    && (employment.EffectiveTo == null || asOf < employment.EffectiveTo))
                .Select(employment => employment.EmployeeId)
                .Distinct()
                .ToListAsync(cancellationToken))
            .ToHashSet();

        var assignments = await dbContext.WorkAssignments
            .AsNoTracking()
            .Where(assignment => employeeIds.Contains(assignment.EmployeeId)
                && assignment.IsPrimary
                && assignment.EffectiveFrom <= asOf
                && (assignment.EffectiveTo == null || asOf < assignment.EffectiveTo))
            .OrderByDescending(assignment => assignment.EffectiveFrom)
            .Select(assignment => new
            {
                assignment.EmployeeId,
                assignment.OrgUnitId,
                assignment.JobTitle
            })
            .ToListAsync(cancellationToken);
        var assignmentByEmployee = assignments
            .GroupBy(assignment => assignment.EmployeeId)
            .ToDictionary(group => group.Key, group => group.First());

        var managerLinks = await dbContext.ManagerRelationships
            .AsNoTracking()
            .Where(relationship => employeeIds.Contains(relationship.SubjectEmployeeId)
                && relationship.Type == ReportingRelationshipType.PrimaryManager
                && relationship.EffectiveFrom <= asOf
                && (relationship.EffectiveTo == null || asOf < relationship.EffectiveTo))
            .OrderByDescending(relationship => relationship.EffectiveFrom)
            .Select(relationship => new
            {
                relationship.SubjectEmployeeId,
                relationship.ManagerEmployeeId
            })
            .ToListAsync(cancellationToken);
        var managerIdByEmployee = managerLinks
            .GroupBy(relationship => relationship.SubjectEmployeeId)
            .ToDictionary(group => group.Key, group => group.First().ManagerEmployeeId);

        var managerIds = managerIdByEmployee.Values.Distinct().ToList();
        var managers = managerIds.Count == 0
            ? new Dictionary<Guid, Employee>()
            : await dbContext.Employees
                .AsNoTracking()
                .Where(employee => managerIds.Contains(employee.Id))
                .ToDictionaryAsync(employee => employee.Id, cancellationToken);
        var activeManagerIds = managerIds.Count == 0
            ? new HashSet<Guid>()
            : (await dbContext.Employments
                .AsNoTracking()
                .Where(employment => managerIds.Contains(employment.EmployeeId)
                    && employment.Status == EmploymentStatus.Active
                    && employment.EffectiveFrom <= asOf
                    && (employment.EffectiveTo == null || asOf < employment.EffectiveTo))
                .Select(employment => employment.EmployeeId)
                .Distinct()
                .ToListAsync(cancellationToken))
                .ToHashSet();

        var orgUnitIds = assignmentByEmployee.Values
            .Select(assignment => assignment.OrgUnitId)
            .Distinct()
            .ToList();
        var orgLookup = orgUnitIds.Count == 0
            ? new Dictionary<Guid, OrgUnit>()
            : await dbContext.OrgUnits
                .AsNoTracking()
                .Where(orgUnit => orgUnitIds.Contains(orgUnit.Id))
                .ToDictionaryAsync(orgUnit => orgUnit.Id, cancellationToken);

        return employees
            .Select(employee =>
            {
                assignmentByEmployee.TryGetValue(employee.Id, out var assignment);
                managerIdByEmployee.TryGetValue(employee.Id, out var managerId);
                managers.TryGetValue(managerId, out var manager);

                var isActive = activeEmployeeIds.Contains(employee.Id);
                return new InternalWorkforceEmployeeSnapshotDto(
                    employee.Id,
                    employee.StableEmployeeKey,
                    employee.FullName,
                    BuildDisplayName(employee),
                    employee.Email,
                    isActive ? assignment?.JobTitle : null,
                    isActive,
                    isActive
                        && assignment is not null
                        && orgLookup.TryGetValue(assignment.OrgUnitId, out var orgUnit)
                            ? new InternalWorkforceOrgSnapshotDto(orgUnit.Id, orgUnit.Name)
                            : null,
                    isActive
                        && manager is not null
                            ? new InternalWorkforceManagerSnapshotDto(
                                manager.Id,
                                BuildDisplayName(manager),
                                activeManagerIds.Contains(manager.Id))
                            : null);
            })
            .ToList();
    }

    private async Task<HashSet<Guid>> ResolveOrgUnitScopeAsync(
        IReadOnlyCollection<Guid> orgUnitIds,
        bool includeDescendants,
        CancellationToken cancellationToken)
    {
        var result = new HashSet<Guid>(orgUnitIds);
        if (!includeDescendants)
        {
            return result;
        }

        var units = await dbContext.OrgUnits
            .AsNoTracking()
            .Select(unit => new { unit.Id, unit.ParentId })
            .ToListAsync(cancellationToken);
        var childrenByParentId = units.ToLookup(unit => unit.ParentId, unit => unit.Id);

        var queue = new Queue<Guid>(orgUnitIds);
        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            foreach (var childId in childrenByParentId[current])
            {
                if (result.Add(childId))
                {
                    queue.Enqueue(childId);
                }
            }
        }

        return result;
    }

    private static string BuildDisplayName(Employee employee)
        => !string.IsNullOrWhiteSpace(employee.PreferredName)
            ? $"{employee.PreferredName} {employee.LastName}"
            : employee.FullName;

    private static DateTime Normalize(DateTime asOf)
        => asOf.Kind switch
        {
            DateTimeKind.Utc => asOf,
            DateTimeKind.Local => asOf.ToUniversalTime(),
            _ => DateTime.SpecifyKind(asOf, DateTimeKind.Utc)
        };
}
