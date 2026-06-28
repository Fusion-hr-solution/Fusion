using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeOrgChart;

public sealed class GetEmployeeOrgChartQueryHandler(
    CoreHRDbContext dbContext,
    ITenantSettingsReadService tenantSettingsReadService) : IQueryHandler<GetEmployeeOrgChartQuery, Result<EmployeeOrgChartDto>>
{
    public async Task<Result<EmployeeOrgChartDto>> Handle(
        GetEmployeeOrgChartQuery request,
        CancellationToken cancellationToken)
    {
        var settings = await tenantSettingsReadService.GetCurrentAsync(cancellationToken);
        var maxDepth = Math.Clamp(request.MaxDepth, 1, 10);
        var now = DateTime.UtcNow;

        // Resolve key-based params to GUIDs
        var rootEmployeeId = request.RootEmployeeId ?? (request.RootEmployeeKey is not null
            ? await ResolveEmployeeIdByKeyAsync(request.RootEmployeeKey, cancellationToken)
            : null);
        var focusEmployeeId = request.FocusEmployeeId ?? (request.FocusEmployeeKey is not null
            ? await ResolveEmployeeIdByKeyAsync(request.FocusEmployeeKey, cancellationToken)
            : null);

        // Load canonical snapshot (employee identity + workforce facts)
        var snapshot = await LoadCanonicalSnapshotAsync(request.IncludeInactive, now, cancellationToken);

        // Resolve effective root: explicit → focus-derived → full org
        Guid? effectiveRootId = rootEmployeeId;
        if (!effectiveRootId.HasValue && focusEmployeeId.HasValue)
        {
            effectiveRootId = ResolveChainRoot(snapshot, focusEmployeeId.Value);
            if (!effectiveRootId.HasValue)
                return Result.Failure<EmployeeOrgChartDto>(Error.NotFound("Employee", focusEmployeeId.Value));
        }

        List<CanonicalEmployeeView> employees;
        if (effectiveRootId.HasValue)
        {
            if (!snapshot.ContainsKey(effectiveRootId.Value))
                return Result.Failure<EmployeeOrgChartDto>(Error.NotFound("Employee", effectiveRootId.Value));

            employees = GetSubtree(snapshot, effectiveRootId.Value, maxDepth + 1);
        }
        else
        {
            employees = [.. snapshot.Values.OrderBy(e => e.LastName).ThenBy(e => e.FirstName)];
        }

        // Apply org unit filter
        if (request.OrgUnitId.HasValue)
            employees = FilterByOrgUnitWithAncestors(employees, snapshot, request.OrgUnitId.Value);

        if (!string.IsNullOrWhiteSpace(request.OrgUnitCode))
        {
            var orgUnit = await dbContext.OrgUnits
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.Code == request.OrgUnitCode.Trim().ToUpperInvariant(), cancellationToken);

            if (orgUnit is not null)
                employees = FilterByOrgUnitWithAncestors(employees, snapshot, orgUnit.Id);
        }

        var visibleIds = employees.Select(e => e.Id).ToHashSet();

        // Children map and direct report counts within visible set
        var reportsByManagerId = employees
            .Where(e => e.ManagerEmployeeId.HasValue && visibleIds.Contains(e.ManagerEmployeeId.Value))
            .GroupBy(e => e.ManagerEmployeeId!.Value)
            .ToDictionary(
                g => g.Key,
                g => g.OrderBy(e => e.LastName).ThenBy(e => e.FirstName).ToList());

        var directReportCounts = reportsByManagerId.ToDictionary(kv => kv.Key, kv => kv.Value.Count);

        // Roots = employees with no manager inside the visible set
        var roots = effectiveRootId.HasValue
            ? new List<(CanonicalEmployeeView Emp, bool IsOrphaned)> { (snapshot[effectiveRootId.Value], false) }
            : employees
                .Where(e => !e.ManagerEmployeeId.HasValue || !visibleIds.Contains(e.ManagerEmployeeId.Value))
                .Select(e => (Emp: e, IsOrphaned: e.ManagerEmployeeId.HasValue))
                .OrderBy(r => r.Emp.LastName)
                .ThenBy(r => r.Emp.FirstName)
                .ToList();

        var visibleNodeCount = 0;
        var isTruncated = false;
        var tree = roots
            .Select(root => BuildTreeNode(
                root.Emp,
                root.IsOrphaned,
                0,
                maxDepth,
                reportsByManagerId,
                directReportCounts,
                settings,
                ref visibleNodeCount,
                ref isTruncated,
                []))
            .ToList();

        var issueCounts = ComputeIssueCounts(employees, visibleIds, directReportCounts);

        return Result.Success(new EmployeeOrgChartDto(
            tree,
            rootEmployeeId,
            focusEmployeeId,
            request.OrgUnitId,
            maxDepth,
            request.IncludeInactive,
            visibleNodeCount,
            isTruncated,
            issueCounts));
    }

    private async Task<Dictionary<Guid, CanonicalEmployeeView>> LoadCanonicalSnapshotAsync(
        bool includeInactive,
        DateTime now,
        CancellationToken cancellationToken)
    {
        // Base employee identities
        IQueryable<Domain.Entities.Employee> employeeQuery = dbContext.Employees.AsNoTracking();

        if (!includeInactive)
        {
            // Only employees with active Employment
            var activeIds = await dbContext.Employments
                .AsNoTracking()
                .Where(e => e.EffectiveFrom <= now && (e.EffectiveTo == null || now < e.EffectiveTo))
                .Select(e => e.EmployeeId)
                .Distinct()
                .ToListAsync(cancellationToken);

            employeeQuery = employeeQuery.Where(e => activeIds.Contains(e.Id));
        }

        var employees = await employeeQuery
            .Select(e => new { e.Id, e.StableEmployeeKey, e.EmployeeNumber, e.FirstName, e.LastName, e.PreferredName, e.Email, e.Phone, e.Version })
            .ToListAsync(cancellationToken);

        if (employees.Count == 0) return [];

        var employeeIds = employees.Select(e => e.Id).ToList();

        // Active Employment set (for isActive flag and hireDate)
        var activeEmploymentByEmployee = await dbContext.Employments
            .AsNoTracking()
            .Where(e => employeeIds.Contains(e.EmployeeId)
                && e.EffectiveFrom <= now && (e.EffectiveTo == null || now < e.EffectiveTo))
            .Select(e => new { e.EmployeeId, e.EffectiveFrom })
            .ToListAsync(cancellationToken);
        var activeEmploymentSet = activeEmploymentByEmployee
            .GroupBy(e => e.EmployeeId)
            .ToDictionary(g => g.Key, g => g.First().EffectiveFrom);

        // Primary WorkAssignment (org unit, job title)
        var primaryAssignments = await dbContext.WorkAssignments
            .AsNoTracking()
            .Where(wa => employeeIds.Contains(wa.EmployeeId)
                && wa.IsPrimary
                && wa.EffectiveFrom <= now && (wa.EffectiveTo == null || now < wa.EffectiveTo))
            .Select(wa => new { wa.EmployeeId, wa.OrgUnitId, wa.JobTitle })
            .ToListAsync(cancellationToken);
        var assignmentByEmployee = primaryAssignments
            .GroupBy(wa => wa.EmployeeId)
            .ToDictionary(g => g.Key, g => g.First());

        // Org unit names for referenced org units
        var orgUnitIds = primaryAssignments.Select(wa => wa.OrgUnitId).Distinct().ToList();
        var orgUnitNames = orgUnitIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await dbContext.OrgUnits
                .AsNoTracking()
                .Where(ou => orgUnitIds.Contains(ou.Id))
                .Select(ou => new { ou.Id, ou.Name })
                .ToDictionaryAsync(ou => ou.Id, ou => ou.Name, cancellationToken);

        // Primary manager relationships (who is each employee's manager)
        var managerLinks = await dbContext.ManagerRelationships
            .AsNoTracking()
            .Where(mr => employeeIds.Contains(mr.SubjectEmployeeId)
                && mr.Type == ReportingRelationshipType.PrimaryManager
                && mr.EffectiveFrom <= now && (mr.EffectiveTo == null || now < mr.EffectiveTo))
            .Select(mr => new { mr.SubjectEmployeeId, mr.ManagerEmployeeId })
            .ToListAsync(cancellationToken);
        var managerByEmployee = managerLinks
            .GroupBy(m => m.SubjectEmployeeId)
            .ToDictionary(g => g.Key, g => g.First().ManagerEmployeeId);

        // Manager info: name + active status for all referenced managers
        var managerIds = managerByEmployee.Values.Distinct().ToList();
        Dictionary<Guid, (string FirstName, string LastName, bool IsActive)> managerInfo = [];
        if (managerIds.Count > 0)
        {
            var managerEmployees = await dbContext.Employees
                .AsNoTracking()
                .Where(e => managerIds.Contains(e.Id))
                .Select(e => new { e.Id, e.FirstName, e.LastName })
                .ToListAsync(cancellationToken);
            var activeManagerIds = (await dbContext.Employments
                .AsNoTracking()
                .Where(e => managerIds.Contains(e.EmployeeId)
                    && e.EffectiveFrom <= now && (e.EffectiveTo == null || now < e.EffectiveTo))
                .Select(e => e.EmployeeId)
                .Distinct()
                .ToListAsync(cancellationToken))
                .ToHashSet();

            managerInfo = managerEmployees.ToDictionary(
                m => m.Id,
                m => (m.FirstName, m.LastName, activeManagerIds.Contains(m.Id)));
        }

        // Build snapshot
        var snapshot = new Dictionary<Guid, CanonicalEmployeeView>(employees.Count);
        foreach (var emp in employees)
        {
            var assignment = assignmentByEmployee.GetValueOrDefault(emp.Id);
            var orgUnitId = assignment?.OrgUnitId;
            var orgUnitName = orgUnitId.HasValue && orgUnitNames.TryGetValue(orgUnitId.Value, out var ouName) ? ouName : null;
            Guid? managerId = managerByEmployee.TryGetValue(emp.Id, out var rawMgrId) ? rawMgrId : null;
            var mgrExists = managerId.HasValue && managerInfo.ContainsKey(managerId.Value);
            var (mgrFirstName, mgrLastName, mgrIsActive) = mgrExists && managerInfo.TryGetValue(managerId!.Value, out var mgr)
                ? mgr
                : default;

            snapshot[emp.Id] = new CanonicalEmployeeView(
                Id: emp.Id,
                StableEmployeeKey: emp.StableEmployeeKey,
                EmployeeNumber: emp.EmployeeNumber,
                FirstName: emp.FirstName,
                LastName: emp.LastName,
                PreferredName: emp.PreferredName,
                Email: emp.Email,
                Phone: emp.Phone,
                IsActive: activeEmploymentSet.ContainsKey(emp.Id),
                HireDate: activeEmploymentSet.GetValueOrDefault(emp.Id),
                ManagerEmployeeId: managerId,
                ManagerFirstName: mgrExists ? mgrFirstName : null,
                ManagerLastName: mgrExists ? mgrLastName : null,
                ManagerExists: mgrExists,
                ManagerIsActive: managerId.HasValue ? mgrIsActive : null,
                OrgUnitId: orgUnitId,
                OrgUnitName: orgUnitName,
                JobTitle: assignment?.JobTitle,
                Version: emp.Version);
        }

        return snapshot;
    }

    private async Task<Guid?> ResolveEmployeeIdByKeyAsync(string employeeKey, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .AsNoTracking()
            .Where(e => e.StableEmployeeKey == employeeKey)
            .Select(e => new { e.Id })
            .FirstOrDefaultAsync(cancellationToken);

        return employee?.Id;
    }

    private static Guid? ResolveChainRoot(
        IReadOnlyDictionary<Guid, CanonicalEmployeeView> snapshot,
        Guid focusEmployeeId)
    {
        if (!snapshot.TryGetValue(focusEmployeeId, out var focus))
            return null;

        var visited = new HashSet<Guid> { focus.Id };
        var currentId = focus.ManagerEmployeeId;
        var rootId = focus.Id;

        while (currentId.HasValue)
        {
            if (!visited.Add(currentId.Value)) break;
            if (!snapshot.TryGetValue(currentId.Value, out var parent)) break;

            rootId = parent.Id;
            currentId = parent.ManagerEmployeeId;
        }

        return rootId;
    }

    private static List<CanonicalEmployeeView> GetSubtree(
        IReadOnlyDictionary<Guid, CanonicalEmployeeView> snapshot,
        Guid rootId,
        int maxLevels)
    {
        var result = new Dictionary<Guid, CanonicalEmployeeView> { [rootId] = snapshot[rootId] };
        var frontier = new HashSet<Guid> { rootId };

        for (var level = 1; level <= maxLevels && frontier.Count > 0; level++)
        {
            var currentFrontier = frontier.ToArray();
            frontier.Clear();

            foreach (var view in snapshot.Values
                .Where(e => e.ManagerEmployeeId.HasValue && currentFrontier.Contains(e.ManagerEmployeeId.Value)))
            {
                if (result.TryAdd(view.Id, view) && level < maxLevels)
                    frontier.Add(view.Id);
            }
        }

        return [.. result.Values.OrderBy(e => e.LastName).ThenBy(e => e.FirstName)];
    }

    private static List<CanonicalEmployeeView> FilterByOrgUnitWithAncestors(
        List<CanonicalEmployeeView> employees,
        IReadOnlyDictionary<Guid, CanonicalEmployeeView> snapshot,
        Guid orgUnitId)
    {
        var result = new Dictionary<Guid, CanonicalEmployeeView>();

        foreach (var employee in employees.Where(e => e.OrgUnitId == orgUnitId))
        {
            result.TryAdd(employee.Id, employee);

            // Walk up the manager chain so the chart hierarchy stays coherent
            var managerId = employee.ManagerEmployeeId;
            var seen = new HashSet<Guid> { employee.Id };
            while (managerId.HasValue && seen.Add(managerId.Value) && snapshot.TryGetValue(managerId.Value, out var manager))
            {
                result.TryAdd(manager.Id, manager);
                managerId = manager.ManagerEmployeeId;
            }
        }

        return [.. result.Values];
    }

    private static OrgChartIssueCountsDto ComputeIssueCounts(
        List<CanonicalEmployeeView> employees,
        HashSet<Guid> visibleIds,
        IReadOnlyDictionary<Guid, int> directReportCounts)
    {
        int noManagerAssigned = 0, managerInactive = 0, managerMissing = 0, missingOrgUnit = 0;

        foreach (var emp in employees)
        {
            if (!emp.OrgUnitId.HasValue) missingOrgUnit++;

            if (!emp.ManagerEmployeeId.HasValue)
            {
                if (directReportCounts.GetValueOrDefault(emp.Id) == 0) noManagerAssigned++;
                // Root employees (have reports but no manager) are healthy
            }
            else if (!emp.ManagerExists)
            {
                managerMissing++;
            }
            else if (emp.ManagerIsActive == false)
            {
                managerInactive++;
            }
        }

        return new OrgChartIssueCountsDto(noManagerAssigned, managerInactive, managerMissing, missingOrgUnit);
    }

    private EmployeeOrgChartNodeDto BuildTreeNode(
        CanonicalEmployeeView employee,
        bool isOrphaned,
        int currentLevel,
        int maxDepth,
        IReadOnlyDictionary<Guid, List<CanonicalEmployeeView>> reportsByManagerId,
        IReadOnlyDictionary<Guid, int> directReportCounts,
        Features.TenantSettings.Dtos.TenantSettingsDto settings,
        ref int visibleNodeCount,
        ref bool isTruncated,
        HashSet<Guid> ancestors)
    {
        visibleNodeCount++;
        var nextAncestors = new HashSet<Guid>(ancestors) { employee.Id };
        var hasVisibleChildren = reportsByManagerId.TryGetValue(employee.Id, out var directReports) && directReports.Count > 0;
        var visibleChildren = new List<EmployeeOrgChartNodeDto>();

        if (hasVisibleChildren)
        {
            if (currentLevel < maxDepth)
            {
                foreach (var child in directReports!)
                {
                    if (nextAncestors.Contains(child.Id)) { isTruncated = true; continue; }

                    visibleChildren.Add(BuildTreeNode(
                        child, false, currentLevel + 1, maxDepth,
                        reportsByManagerId, directReportCounts, settings,
                        ref visibleNodeCount, ref isTruncated, nextAncestors));
                }
            }
            else
            {
                isTruncated = true;
            }
        }

        var hierarchyStatus = ResolveHierarchyStatus(employee, directReportCounts.GetValueOrDefault(employee.Id));
        var managerName = employee.ManagerExists
            ? $"{employee.ManagerFirstName} {employee.ManagerLastName}".Trim()
            : null;

        return new EmployeeOrgChartNodeDto(
            employee.Id,
            employee.StableEmployeeKey,
            $"{employee.FirstName} {employee.LastName}",
            employee.FirstName,
            employee.LastName,
            employee.Email,
            CanViewField(settings, "jobTitle") ? employee.JobTitle : null,
            employee.IsActive ? EmployeeStatus.Active : EmployeeStatus.Inactive,
            employee.OrgUnitId,
            employee.OrgUnitName,
            employee.ManagerEmployeeId,
            managerName,
            hierarchyStatus,
            directReportCounts.GetValueOrDefault(employee.Id),
            hasVisibleChildren,
            isOrphaned,
            currentLevel,
            visibleChildren,
            employee.Version);
    }

    private static string ResolveHierarchyStatus(CanonicalEmployeeView employee, int directReportCount)
    {
        if (!employee.ManagerEmployeeId.HasValue)
        {
            return directReportCount > 0
                ? EmployeeHierarchyStatuses.Root
                : EmployeeHierarchyStatuses.NoManagerAssigned;
        }

        if (!employee.ManagerExists) return EmployeeHierarchyStatuses.ManagerMissing;

        return employee.ManagerIsActive == true
            ? EmployeeHierarchyStatuses.Healthy
            : EmployeeHierarchyStatuses.ManagerInactive;
    }

    private static bool CanViewField(Features.TenantSettings.Dtos.TenantSettingsDto settings, string fieldName)
        => !settings.EmployeeFieldConfig.TryGetValue(fieldName, out var config) || config.Visible;
}

/// <summary>
/// Merged in-memory view of one employee with canonical workforce facts resolved from
/// Employment, WorkAssignment, ManagerRelationship, and OrgUnit as of a given instant.
/// </summary>
internal sealed record CanonicalEmployeeView(
    Guid Id,
    string StableEmployeeKey,
    string? EmployeeNumber,
    string FirstName,
    string LastName,
    string? PreferredName,
    string Email,
    string? Phone,
    bool IsActive,
    DateTime HireDate,
    Guid? ManagerEmployeeId,
    string? ManagerFirstName,
    string? ManagerLastName,
    bool ManagerExists,
    bool? ManagerIsActive,
    Guid? OrgUnitId,
    string? OrgUnitName,
    string? JobTitle,
    uint Version);
