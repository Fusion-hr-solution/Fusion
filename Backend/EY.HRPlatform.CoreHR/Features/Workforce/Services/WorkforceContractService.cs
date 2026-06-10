using System.Security.Claims;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Features.Workforce.Dtos;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Workforce.Services;

public interface IWorkforceContractService
{
    Task<WorkforceCurrentUserContextDto> GetCurrentUserContextAsync(ClaimsPrincipal user, CancellationToken cancellationToken);
    Task<WorkforceEmployeeSummaryDto?> GetEmployeeAsync(Guid employeeId, ClaimsPrincipal user, CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkforceEmployeeSummaryDto>> ResolveEmployeesAsync(IReadOnlyCollection<Guid> employeeIds, ClaimsPrincipal user, CancellationToken cancellationToken);
    Task<PagedResponse<WorkforceEmployeeSummaryDto>> SearchEmployeesAsync(string? search, int page, int pageSize, ClaimsPrincipal user, CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkforceEmployeeSummaryDto>> GetTeamAsync(Guid employeeId, ClaimsPrincipal user, CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkforceEmployeeSummaryDto>> GetManagerChainAsync(Guid employeeId, ClaimsPrincipal user, CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkforceOrgUnitSummaryDto>> GetPublishedOrgUnitsAsync(bool includeInactive, CancellationToken cancellationToken);
    Task<WorkforceOrgUnitTreeDto> GetPublishedOrgUnitTreeAsync(Guid? rootId, int maxDepth, bool includeInactive, CancellationToken cancellationToken);
}

public sealed class WorkforceContractService(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    ITenantSettingsReadService tenantSettingsReadService,
    IEmployeeReadModelPolicy employeeReadModelPolicy) : IWorkforceContractService
{
    private const int MaxSearchPageSize = 100;

    public async Task<WorkforceCurrentUserContextDto> GetCurrentUserContextAsync(
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var access = BuildAccessContext(user);
        var structureInfo = await GetStructureInfoAsync(cancellationToken);
        WorkforceEmployeeSummaryDto? employee = null;

        if (access.LinkedEmployeeId.HasValue)
        {
            employee = await GetEmployeeAsync(access.LinkedEmployeeId.Value, user, cancellationToken);
        }

        var managerScope = access.IsManager && access.LinkedEmployeeId.HasValue
            ? new WorkforceManagerScopeDto(
                "DirectReports",
                access.LinkedEmployeeId.Value,
                employee?.DirectReportCount ?? 0,
                false)
            : null;

        return new WorkforceCurrentUserContextDto(
            user.GetUserId(),
            tenantContext.TenantId,
            access.LinkedEmployeeId,
            user.Claims
                .Where(claim => claim.Type == ClaimTypes.Role)
                .Select(claim => claim.Value)
                .Distinct(StringComparer.Ordinal)
                .ToArray(),
            employee,
            managerScope,
            employee is not null,
            structureInfo.PublishedStructureVersion,
            structureInfo.IsOperational);
    }

    public async Task<WorkforceEmployeeSummaryDto?> GetEmployeeAsync(
        Guid employeeId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var access = BuildAccessContext(user);

        var employee = await ApplyVisibilityScope(
                dbContext.Employees
                    .AsNoTracking()
                    .Include(current => current.Manager)
                    .Include(current => current.OrgUnit),
                access)
            .FirstOrDefaultAsync(current => current.Id == employeeId, cancellationToken);

        if (employee is null)
        {
            return null;
        }

        var items = await BuildSummariesAsync([employee], access.Audience, cancellationToken);
        return items.Single();
    }

    public async Task<IReadOnlyList<WorkforceEmployeeSummaryDto>> ResolveEmployeesAsync(
        IReadOnlyCollection<Guid> employeeIds,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (employeeIds.Count == 0)
        {
            return [];
        }

        var access = BuildAccessContext(user);
        var employees = await ApplyVisibilityScope(
                dbContext.Employees
                    .AsNoTracking()
                    .Include(current => current.Manager)
                    .Include(current => current.OrgUnit),
                access)
            .Where(current => employeeIds.Contains(current.Id))
            .OrderBy(current => current.LastName)
            .ThenBy(current => current.FirstName)
            .ToListAsync(cancellationToken);

        return await BuildSummariesAsync(employees, access.Audience, cancellationToken);
    }

    public async Task<PagedResponse<WorkforceEmployeeSummaryDto>> SearchEmployeesAsync(
        string? search,
        int page,
        int pageSize,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var access = BuildAccessContext(user);
        var currentPage = Math.Max(1, page);
        var currentPageSize = Math.Clamp(pageSize, 1, MaxSearchPageSize);

        var query = ApplyVisibilityScope(
                dbContext.Employees
                    .AsNoTracking()
                    .Include(current => current.Manager)
                    .Include(current => current.OrgUnit),
                access)
            .Where(current => current.Status == EmployeeStatus.Active);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchTerm = search.Trim().ToLowerInvariant();
            query = query.Where(current =>
                current.FirstName.ToLower().Contains(searchTerm) ||
                current.LastName.ToLower().Contains(searchTerm) ||
                current.Email.ToLower().Contains(searchTerm) ||
                (current.EmployeeNumber != null && current.EmployeeNumber.ToLower().Contains(searchTerm)) ||
                (current.FirstName + " " + current.LastName).ToLower().Contains(searchTerm));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var employees = await query
            .OrderBy(current => current.LastName)
            .ThenBy(current => current.FirstName)
            .Skip((currentPage - 1) * currentPageSize)
            .Take(currentPageSize)
            .ToListAsync(cancellationToken);

        var items = await BuildSummariesAsync(employees, access.Audience, cancellationToken);

        return new PagedResponse<WorkforceEmployeeSummaryDto>
        {
            Items = items.ToList(),
            TotalCount = totalCount,
            Page = currentPage,
            PageSize = currentPageSize
        };
    }

    public async Task<IReadOnlyList<WorkforceEmployeeSummaryDto>> GetTeamAsync(
        Guid employeeId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var access = BuildAccessContext(user);
        if (!access.IsHrAdmin && access.LinkedEmployeeId != employeeId)
        {
            return [];
        }

        var employees = await dbContext.Employees
            .AsNoTracking()
            .Include(current => current.Manager)
            .Include(current => current.OrgUnit)
            .Where(current => current.ManagerId == employeeId)
            .OrderBy(current => current.LastName)
            .ThenBy(current => current.FirstName)
            .ToListAsync(cancellationToken);

        return await BuildSummariesAsync(employees, access.Audience, cancellationToken);
    }

    public async Task<IReadOnlyList<WorkforceEmployeeSummaryDto>> GetManagerChainAsync(
        Guid employeeId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var access = BuildAccessContext(user);
        var employee = await ApplyVisibilityScope(
                dbContext.Employees
                    .AsNoTracking()
                    .Include(current => current.Manager)
                    .Include(current => current.OrgUnit),
                access)
            .FirstOrDefaultAsync(current => current.Id == employeeId, cancellationToken);

        if (employee is null)
        {
            return [];
        }

        var chain = new List<Employee>();
        var currentManagerId = employee.ManagerId;
        var guard = new HashSet<Guid>();

        while (currentManagerId.HasValue && guard.Add(currentManagerId.Value))
        {
            var manager = await dbContext.Employees
                .AsNoTracking()
                .Include(current => current.Manager)
                .Include(current => current.OrgUnit)
                .FirstOrDefaultAsync(current => current.Id == currentManagerId.Value, cancellationToken);

            if (manager is null)
            {
                break;
            }

            chain.Add(manager);
            currentManagerId = manager.ManagerId;
        }

        chain.Reverse();
        return await BuildSummariesAsync(chain, access.Audience, cancellationToken);
    }

    public async Task<IReadOnlyList<WorkforceOrgUnitSummaryDto>> GetPublishedOrgUnitsAsync(
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        var structureInfo = await GetStructureInfoAsync(cancellationToken);
        var orgUnits = await dbContext.OrgUnits
            .AsNoTracking()
            .Where(unit => includeInactive || unit.IsActive)
            .OrderBy(unit => unit.Name)
            .ToListAsync(cancellationToken);
        var orgLookup = orgUnits.ToDictionary(unit => unit.Id);

        return orgUnits
            .Select(unit => BuildOrgUnitSummary(unit, orgLookup, structureInfo.PublishedStructureVersion))
            .ToList();
    }

    public async Task<WorkforceOrgUnitTreeDto> GetPublishedOrgUnitTreeAsync(
        Guid? rootId,
        int maxDepth,
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        var structureInfo = await GetStructureInfoAsync(cancellationToken);
        var units = await dbContext.OrgUnits
            .AsNoTracking()
            .Where(unit => includeInactive || unit.IsActive)
            .OrderBy(unit => unit.Name)
            .ToListAsync(cancellationToken);

        var orgLookup = units.ToDictionary(unit => unit.Id);
        var childrenByParentId = units
            .ToLookup(unit => unit.ParentId, unit => unit);

        IReadOnlyList<OrgUnit> roots;
        if (rootId.HasValue)
        {
            if (!orgLookup.TryGetValue(rootId.Value, out var root))
            {
                return new WorkforceOrgUnitTreeDto([], structureInfo.PublishedStructureVersion);
            }

            roots = [root];
        }
        else
        {
            roots = childrenByParentId[null]
                .OrderBy(unit => unit.Name)
                .ToList();
        }

        var normalizedMaxDepth = Math.Clamp(maxDepth, 1, 25);
        var nodes = roots
            .Select(root => BuildOrgUnitTreeNode(root, childrenByParentId, orgLookup, structureInfo.PublishedStructureVersion, 0, normalizedMaxDepth))
            .ToList();

        return new WorkforceOrgUnitTreeDto(nodes, structureInfo.PublishedStructureVersion);
    }

    private async Task<IReadOnlyList<WorkforceEmployeeSummaryDto>> BuildSummariesAsync(
        IReadOnlyCollection<Employee> employees,
        EmployeeReadAudience audience,
        CancellationToken cancellationToken)
    {
        if (employees.Count == 0)
        {
            return [];
        }

        var settings = await tenantSettingsReadService.GetCurrentAsync(cancellationToken);
        var structureInfo = await GetStructureInfoAsync(cancellationToken);
        var employeeIds = employees.Select(employee => employee.Id).ToArray();
        var directReportCounts = await dbContext.Employees
            .AsNoTracking()
            .Where(employee => employee.ManagerId.HasValue
                && employee.Status == EmployeeStatus.Active
                && employeeIds.Contains(employee.ManagerId.Value))
            .GroupBy(employee => employee.ManagerId!.Value)
            .Select(group => new { ManagerId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(group => group.ManagerId, group => group.Count, cancellationToken);

        var orgUnits = await dbContext.OrgUnits
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        var orgLookup = orgUnits.ToDictionary(unit => unit.Id);

        return employees
            .Select(employee =>
            {
                var directReportCount = directReportCounts.GetValueOrDefault(employee.Id);
                var profile = employeeReadModelPolicy.MapProfile(employee, settings, audience, directReportCount);
                return new WorkforceEmployeeSummaryDto(
                    employee.Id,
                    employee.EmployeeNumber ?? employee.Id.ToString(),
                    employee.EmployeeNumber,
                    profile.FirstName,
                    profile.LastName,
                    profile.PreferredName,
                    profile.DisplayName,
                    profile.FullName,
                    profile.Email,
                    profile.JobTitle,
                    profile.HireDate,
                    profile.Status.ToString(),
                    profile.Status == EmployeeStatus.Active,
                    BuildOrgAssignment(employee.OrgUnitId, orgLookup, structureInfo.PublishedStructureVersion),
                    employee.Manager is null
                        ? null
                        : new WorkforceManagerSummaryDto(
                            employee.Manager.Id,
                            !string.IsNullOrWhiteSpace(employee.Manager.PreferredName)
                                ? $"{employee.Manager.PreferredName} {employee.Manager.LastName}"
                                : employee.Manager.FullName,
                            employee.Manager.Email,
                            employee.Manager.Status == EmployeeStatus.Active),
                    directReportCount,
                    BuildDataQuality(profile.Readiness),
                    profile.Version);
            })
            .ToList();
    }

    private IQueryable<Employee> ApplyVisibilityScope(IQueryable<Employee> query, WorkforceAccessContext access)
    {
        if (access.IsHrAdmin)
        {
            return query;
        }

        if (!access.LinkedEmployeeId.HasValue)
        {
            return query.Where(_ => false);
        }

        if (access.IsManager)
        {
            var linkedEmployeeId = access.LinkedEmployeeId.Value;
            return query.Where(employee => employee.Id == linkedEmployeeId || employee.ManagerId == linkedEmployeeId);
        }

        return query.Where(employee => employee.Id == access.LinkedEmployeeId.Value);
    }

    private static WorkforceDataQualityDto BuildDataQuality(EmployeeReadinessSummaryDto readiness)
    {
        var issueCodes = readiness.EmployeeStateIssues
            .Concat(readiness.BlockingIssues)
            .Select(issue => issue.Code)
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        var state = readiness.HasBlockingIssues
            ? "Blocked"
            : readiness.HasEmployeeStateIssues
                ? "NeedsAttention"
                : "Ready";

        return new WorkforceDataQualityDto(
            state,
            readiness.HasEmployeeStateIssues,
            readiness.HasBlockingIssues,
            issueCodes);
    }

    private WorkforceOrgAssignmentDto? BuildOrgAssignment(
        Guid? orgUnitId,
        IReadOnlyDictionary<Guid, OrgUnit> orgLookup,
        int publishedStructureVersion)
    {
        if (!orgUnitId.HasValue || !orgLookup.TryGetValue(orgUnitId.Value, out var orgUnit))
        {
            return null;
        }

        return new WorkforceOrgAssignmentDto(
            orgUnit.Id,
            orgUnit.Code,
            orgUnit.Name,
            orgUnit.Type,
            orgUnit.ParentId.HasValue && orgLookup.TryGetValue(orgUnit.ParentId.Value, out var parent)
                ? parent.Code
                : null,
            BuildOrgPath(orgUnit, orgLookup),
            GetOrgLevel(orgUnit, orgLookup),
            orgUnit.IsActive,
            publishedStructureVersion);
    }

    private WorkforceOrgUnitSummaryDto BuildOrgUnitSummary(
        OrgUnit orgUnit,
        IReadOnlyDictionary<Guid, OrgUnit> orgLookup,
        int publishedStructureVersion)
        => new(
            orgUnit.Id,
            orgUnit.Code,
            orgUnit.Name,
            orgUnit.Type,
            orgUnit.ParentId.HasValue && orgLookup.TryGetValue(orgUnit.ParentId.Value, out var parent)
                ? parent.Code
                : null,
            BuildOrgPath(orgUnit, orgLookup),
            GetOrgLevel(orgUnit, orgLookup),
            orgUnit.IsActive,
            publishedStructureVersion);

    private WorkforceOrgUnitTreeNodeDto BuildOrgUnitTreeNode(
        OrgUnit orgUnit,
        ILookup<Guid?, OrgUnit> childrenByParentId,
        IReadOnlyDictionary<Guid, OrgUnit> orgLookup,
        int publishedStructureVersion,
        int depth,
        int maxDepth)
    {
        var childUnits = childrenByParentId[orgUnit.Id]
            .OrderBy(child => child.Name)
            .ToList();
        var children = depth + 1 >= maxDepth || childUnits.Count == 0
            ? []
            : childUnits
                .Select(child => BuildOrgUnitTreeNode(child, childrenByParentId, orgLookup, publishedStructureVersion, depth + 1, maxDepth))
                .ToList();

        return new WorkforceOrgUnitTreeNodeDto(
            orgUnit.Id,
            orgUnit.Code,
            orgUnit.Name,
            orgUnit.Type,
            orgUnit.ParentId.HasValue && orgLookup.TryGetValue(orgUnit.ParentId.Value, out var parent)
                ? parent.Code
                : null,
            BuildOrgPath(orgUnit, orgLookup),
            GetOrgLevel(orgUnit, orgLookup),
            orgUnit.IsActive,
            publishedStructureVersion,
            children);
    }

    private async Task<(int PublishedStructureVersion, bool IsOperational)> GetStructureInfoAsync(CancellationToken cancellationToken)
    {
        var setupState = await dbContext.TenantSetupStates
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        return (
            setupState?.PublishedStructureVersion ?? 0,
            setupState?.CurrentPhase >= TenantSetupPhase.StructurallyPublished);
    }

    private static string BuildOrgPath(OrgUnit orgUnit, IReadOnlyDictionary<Guid, OrgUnit> orgLookup)
    {
        var segments = new List<string>();
        OrgUnit? current = orgUnit;
        var guard = new HashSet<Guid>();

        while (current is not null && guard.Add(current.Id))
        {
            segments.Add(current.Name);
            current = current.ParentId.HasValue && orgLookup.TryGetValue(current.ParentId.Value, out var parent)
                ? parent
                : null;
        }

        segments.Reverse();
        return string.Join(" / ", segments);
    }

    private static int GetOrgLevel(OrgUnit orgUnit, IReadOnlyDictionary<Guid, OrgUnit> orgLookup)
    {
        var level = 0;
        var currentParentId = orgUnit.ParentId;
        var guard = new HashSet<Guid>();

        while (currentParentId.HasValue && guard.Add(currentParentId.Value) && orgLookup.TryGetValue(currentParentId.Value, out var parent))
        {
            level += 1;
            currentParentId = parent.ParentId;
        }

        return level;
    }

    private static WorkforceAccessContext BuildAccessContext(ClaimsPrincipal user)
        => new(
            user.IsInRole(PlatformRole.HRAdmin),
            user.IsInRole(PlatformRole.Manager),
            user.IsInRole(PlatformRole.Employee),
            user.GetEmployeeId(),
            user.IsInRole(PlatformRole.HRAdmin)
                ? EmployeeReadAudience.HrAdmin
                : user.IsInRole(PlatformRole.Manager)
                    ? EmployeeReadAudience.Manager
                    : EmployeeReadAudience.Employee);

    private sealed record WorkforceAccessContext(
        bool IsHrAdmin,
        bool IsManager,
        bool IsEmployee,
        Guid? LinkedEmployeeId,
        EmployeeReadAudience Audience);
}
