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
    Task<IReadOnlyList<WorkforceEmployeeSummaryDto>> GetEmployeesByScopeAsync(IReadOnlyCollection<Guid> orgUnitIds, bool includeDescendants, bool includeInactive, ClaimsPrincipal user, CancellationToken cancellationToken);
    Task<PagedResponse<WorkforceAccessSubjectSummaryDto>> SearchAccessSubjectsAsync(
        string? search,
        string? access,
        Guid? profileId,
        string? employeeStatus,
        string? deliveryState,
        string? employeeKey,
        int page,
        int pageSize,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkforceAccessSubjectSummaryDto>> GetAccessSubjectSelectionPreviewAsync(
        string? search,
        string? access,
        Guid? profileId,
        string? employeeStatus,
        string? deliveryState,
        string? employeeKey,
        CancellationToken cancellationToken);
    Task<WorkforceAccessRosterSummaryDto> GetAccessRosterSummaryAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkforceEmployeeSummaryDto>> GetTeamAsync(Guid employeeId, ClaimsPrincipal user, CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkforceEmployeeSummaryDto>> GetDownlineAsync(Guid employeeId, int maxDepth, ClaimsPrincipal user, CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkforceEmployeeSummaryDto>> GetManagerChainAsync(Guid employeeId, ClaimsPrincipal user, CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkforceOrgUnitSummaryDto>> GetPublishedOrgUnitsAsync(bool includeInactive, CancellationToken cancellationToken);
    Task<WorkforceOrgUnitTreeDto> GetPublishedOrgUnitTreeAsync(Guid? rootId, int maxDepth, bool includeInactive, CancellationToken cancellationToken);
    Task<WorkforceBulkInviteResponseDto> BulkInviteAsync(WorkforceBulkInviteRequest request, ClaimsPrincipal user, CancellationToken cancellationToken);
}

public sealed class WorkforceContractService(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    ITenantSettingsReadService tenantSettingsReadService,
    IEmployeeReadModelPolicy employeeReadModelPolicy,
    IWorkforceAccountStatusReader workforceAccountStatusReader,
    IWorkforceBulkProvisioner workforceBulkProvisioner) : IWorkforceContractService
{
    private const int MaxSearchPageSize = 100;
    private const string AccessStateNotInvited = "NotInvited";
    private const string AccessStateInvitePending = "InvitePending";
    private const string AccessStateActiveAccount = "ActiveAccount";
    private const string AccessStateNeedsReview = "NeedsReview";

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

    public async Task<IReadOnlyList<WorkforceEmployeeSummaryDto>> GetEmployeesByScopeAsync(
        IReadOnlyCollection<Guid> orgUnitIds,
        bool includeDescendants,
        bool includeInactive,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (orgUnitIds.Count == 0)
        {
            return [];
        }

        var access = BuildAccessContext(user);
        var targetOrgUnitIds = await ResolveOrgUnitScopeAsync(orgUnitIds, includeDescendants, cancellationToken);
        if (targetOrgUnitIds.Count == 0)
        {
            return [];
        }

        var query = ApplyVisibilityScope(
                dbContext.Employees
                    .AsNoTracking()
                    .Include(current => current.Manager)
                    .Include(current => current.OrgUnit),
                access)
            .Where(current => current.OrgUnitId.HasValue && targetOrgUnitIds.Contains(current.OrgUnitId.Value));

        if (!includeInactive)
        {
            query = query.Where(current => current.Status == EmployeeStatus.Active);
        }

        var employees = await query
            .OrderBy(current => current.LastName)
            .ThenBy(current => current.FirstName)
            .ToListAsync(cancellationToken);

        return await BuildSummariesAsync(employees, access.Audience, cancellationToken);
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

    public async Task<PagedResponse<WorkforceAccessSubjectSummaryDto>> SearchAccessSubjectsAsync(
        string? search,
        string? access,
        Guid? profileId,
        string? employeeStatus,
        string? deliveryState,
        string? employeeKey,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var currentPage = Math.Max(1, page);
        var currentPageSize = Math.Clamp(pageSize, 1, MaxSearchPageSize);
        var normalizedAccess = NormalizeAccessFilter(access);
        var normalizedDeliveryState = NormalizeDeliveryStateFilter(deliveryState);

        var query = ApplyAccessSubjectFilters(
            dbContext.Employees
                .AsNoTracking()
                .AsQueryable(),
            search,
            employeeStatus,
            employeeKey);

        var requiresAccountFiltering =
            normalizedAccess is not null
            || profileId.HasValue
            || normalizedDeliveryState is not null;

        List<Employee> pageEmployees;
        IReadOnlyDictionary<Guid, WorkforceAccountStatusDto> statuses;
        int totalCount;

        if (requiresAccountFiltering)
        {
            var candidateEmployees = await query
                .OrderBy(current => current.LastName)
                .ThenBy(current => current.FirstName)
                .ToListAsync(cancellationToken);

            statuses = await LoadWorkforceAccountStatusesAsync(candidateEmployees, cancellationToken);
            var filteredEmployees = candidateEmployees
                .Where(employee => MatchesAccessFilters(
                    statuses.GetValueOrDefault(employee.Id),
                    normalizedAccess,
                    profileId,
                    normalizedDeliveryState))
                .ToList();

            totalCount = filteredEmployees.Count;
            pageEmployees = filteredEmployees
                .Skip((currentPage - 1) * currentPageSize)
                .Take(currentPageSize)
                .ToList();
        }
        else
        {
            totalCount = await query.CountAsync(cancellationToken);
            pageEmployees = await query
                .OrderBy(current => current.LastName)
                .ThenBy(current => current.FirstName)
                .Skip((currentPage - 1) * currentPageSize)
                .Take(currentPageSize)
                .ToListAsync(cancellationToken);
            statuses = await LoadWorkforceAccountStatusesAsync(pageEmployees, cancellationToken);
        }

        var directReportCounts = await LoadDirectReportCountsAsync(
            pageEmployees.Select(employee => employee.Id).ToList(),
            cancellationToken);
        var employees = pageEmployees
            .Select(employee => BuildAccessSubjectSummary(
                employee,
                statuses.GetValueOrDefault(employee.Id),
                directReportCounts.GetValueOrDefault(employee.Id)))
            .ToList();

        return new PagedResponse<WorkforceAccessSubjectSummaryDto>
        {
            Items = employees,
            TotalCount = totalCount,
            Page = currentPage,
            PageSize = currentPageSize,
        };
    }

    public async Task<IReadOnlyList<WorkforceAccessSubjectSummaryDto>> GetAccessSubjectSelectionPreviewAsync(
        string? search,
        string? access,
        Guid? profileId,
        string? employeeStatus,
        string? deliveryState,
        string? employeeKey,
        CancellationToken cancellationToken)
    {
        var (matchingEmployees, statuses) = await LoadMatchingAccessSubjectEmployeesAsync(
            search,
            access,
            profileId,
            employeeStatus,
            deliveryState,
            employeeKey,
            cancellationToken);

        return await BuildAccessSubjectSummariesAsync(
            matchingEmployees,
            statuses,
            cancellationToken);
    }

    public async Task<WorkforceAccessRosterSummaryDto> GetAccessRosterSummaryAsync(
        CancellationToken cancellationToken)
    {
        var employees = await dbContext.Employees
            .AsNoTracking()
            .OrderBy(current => current.LastName)
            .ThenBy(current => current.FirstName)
            .ToListAsync(cancellationToken);
        var statuses = await LoadWorkforceAccountStatusesAsync(employees, cancellationToken);
        var accessStates = employees
            .Select(employee => ClassifyAccessState(statuses.GetValueOrDefault(employee.Id)))
            .ToList();

        return new WorkforceAccessRosterSummaryDto(
            employees.Count,
            accessStates.Count(state => state == AccessStateNotInvited),
            accessStates.Count(state => state == AccessStateInvitePending),
            accessStates.Count(state => state == AccessStateActiveAccount),
            accessStates.Count(state => state == AccessStateNeedsReview));
    }

    public async Task<WorkforceBulkInviteResponseDto> BulkInviteAsync(
        WorkforceBulkInviteRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var access = BuildAccessContext(user);
        if (!access.IsHrAdmin)
        {
            throw new InvalidOperationException("Only HR admins can perform bulk invites.");
        }

        List<Employee> matchingEmployees;
        IReadOnlyDictionary<Guid, WorkforceAccountStatusDto> statuses;

        if (request.SpecificEmployeeIds is { Count: > 0 })
        {
            matchingEmployees = await dbContext.Employees
                .AsNoTracking()
                .Where(e => request.SpecificEmployeeIds.Contains(e.Id))
                .ToListAsync(cancellationToken);
            statuses = await LoadWorkforceAccountStatusesAsync(matchingEmployees, cancellationToken);
        }
        else
        {
            (matchingEmployees, statuses) = await LoadMatchingAccessSubjectEmployeesAsync(
                request.Search,
                request.Access,
                request.ProfileId,
                request.EmployeeStatus,
                request.DeliveryState,
                request.EmployeeKey,
                cancellationToken);
        }

        if (matchingEmployees.Count == 0)
        {
            return new WorkforceBulkInviteResponseDto([], 0, 0, 0, 0, 0);
        }

        var accessProfileId = await ResolveProvisioningAccessProfileIdAsync(
            request.AccessProfileId,
            cancellationToken);

        var freshInviteEmployees = new List<Employee>();
        var refreshInviteEmployees = new List<Employee>();
        var alreadyActiveEmployees = new List<Employee>();
        var skippedEmployees = new List<Employee>();

        foreach (var employee in matchingEmployees)
        {
            var status = statuses.GetValueOrDefault(employee.Id);
            var provisioningState = status?.ProvisioningState ?? "Unprovisioned";

            switch (provisioningState)
            {
                case "Unprovisioned":
                case "InviteRevoked":
                    freshInviteEmployees.Add(employee);
                    break;
                case "InvitePending":
                case "InviteExpired":
                case "InviteAccepted":
                    refreshInviteEmployees.Add(employee);
                    break;
                case "Active":
                    alreadyActiveEmployees.Add(employee);
                    break;
                default:
                    skippedEmployees.Add(employee);
                    break;
            }
        }

        var sendToIdentity = freshInviteEmployees.Concat(refreshInviteEmployees).ToList();
        var freshIds = freshInviteEmployees.Select(e => e.Id).ToHashSet();

        var items = new List<WorkforceBulkInviteResultItemDto>();
        int invitedCount = 0;
        int refreshedCount = 0;

        if (sendToIdentity.Count > 0)
        {
            var subjects = sendToIdentity
                .Select(e => new WorkforceBulkProvisionSubject(e.Id, e.Email, e.FirstName, e.LastName))
                .ToList();

            var provisionResult = await workforceBulkProvisioner.BulkProvisionAsync(
                subjects,
                accessProfileId,
                cancellationToken);

            var employeeLookup = matchingEmployees.ToDictionary(e => e.Id);

            foreach (var result in provisionResult.Items)
            {
                var employee = employeeLookup.GetValueOrDefault(result.EmployeeId);
                items.Add(new WorkforceBulkInviteResultItemDto(
                    result.EmployeeId,
                    employee?.DisplayName ?? "Unknown",
                    employee?.Email ?? "",
                    result.Outcome,
                    result.Message));

                if (result.Outcome is "Created")
                {
                    if (freshIds.Contains(result.EmployeeId))
                        invitedCount++;
                    else
                        refreshedCount++;
                }
            }
        }

        foreach (var employee in alreadyActiveEmployees)
        {
            items.Add(new WorkforceBulkInviteResultItemDto(
                employee.Id,
                employee.DisplayName,
                employee.Email,
                "Active",
                "Account is already active."));
        }

        foreach (var employee in skippedEmployees)
        {
            items.Add(new WorkforceBulkInviteResultItemDto(
                employee.Id,
                employee.DisplayName,
                employee.Email,
                "Skipped",
                "Account is not eligible for invitation."));
        }

        return new WorkforceBulkInviteResponseDto(
            items,
            matchingEmployees.Count,
            invitedCount,
            refreshedCount,
            alreadyActiveEmployees.Count,
            skippedEmployees.Count);
    }

    private async Task<Guid> ResolveProvisioningAccessProfileIdAsync(
        Guid requestedAccessProfileId,
        CancellationToken cancellationToken)
    {
        if (requestedAccessProfileId != Guid.Empty)
        {
            return requestedAccessProfileId;
        }

        var settings = await tenantSettingsReadService.GetCurrentAsync(cancellationToken);
        if (settings.Provisioning.DefaultAccessProfileId.HasValue
            && settings.Provisioning.DefaultAccessProfileId.Value != Guid.Empty)
        {
            return settings.Provisioning.DefaultAccessProfileId.Value;
        }

        throw new InvalidOperationException(
            "Access profile is required. Configure a provisioning default or choose a profile before inviting employees.");
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

    public async Task<IReadOnlyList<WorkforceEmployeeSummaryDto>> GetDownlineAsync(
        Guid employeeId,
        int maxDepth,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var access = BuildAccessContext(user);
        // A non-admin may only resolve their own subtree; HR/tenant readers may resolve any.
        if (!access.IsHrAdmin && access.LinkedEmployeeId != employeeId)
        {
            return [];
        }

        var normalizedMaxDepth = Math.Clamp(maxDepth, 1, 25);

        // Load the active manager edges once, then walk the subtree in memory (bounded + cycle-guarded).
        var managerEdges = await dbContext.Employees
            .AsNoTracking()
            .Where(current => current.Status == EmployeeStatus.Active && current.ManagerId.HasValue)
            .Select(current => new { current.Id, ManagerId = current.ManagerId!.Value })
            .ToListAsync(cancellationToken);
        var reportsByManager = managerEdges.ToLookup(edge => edge.ManagerId, edge => edge.Id);

        var subtreeIds = new List<Guid>();
        var visited = new HashSet<Guid> { employeeId };
        var frontier = new Queue<(Guid Id, int Depth)>();
        frontier.Enqueue((employeeId, 0));

        while (frontier.Count > 0)
        {
            var (currentId, depth) = frontier.Dequeue();
            if (depth >= normalizedMaxDepth)
            {
                continue;
            }

            foreach (var reportId in reportsByManager[currentId])
            {
                if (!visited.Add(reportId))
                {
                    continue;
                }

                subtreeIds.Add(reportId);
                frontier.Enqueue((reportId, depth + 1));
            }
        }

        if (subtreeIds.Count == 0)
        {
            return [];
        }

        var employees = await dbContext.Employees
            .AsNoTracking()
            .Include(current => current.Manager)
            .Include(current => current.OrgUnit)
            .Where(current => subtreeIds.Contains(current.Id))
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

        // Direct active-member count per unit, plus a full-subtree rollup computed over the entire
        // hierarchy (independent of the render maxDepth so truncated branches still count).
        var directMemberCounts = await dbContext.Employees
            .AsNoTracking()
            .Where(employee => employee.Status == EmployeeStatus.Active && employee.OrgUnitId.HasValue)
            .GroupBy(employee => employee.OrgUnitId!.Value)
            .Select(group => new { OrgUnitId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(group => group.OrgUnitId, group => group.Count, cancellationToken);

        var totalMemberCounts = new Dictionary<Guid, int>();
        int ComputeTotal(OrgUnit unit)
        {
            var total = directMemberCounts.GetValueOrDefault(unit.Id, 0)
                + childrenByParentId[unit.Id].Sum(ComputeTotal);
            totalMemberCounts[unit.Id] = total;
            return total;
        }
        foreach (var topLevel in childrenByParentId[null])
        {
            ComputeTotal(topLevel);
        }

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
            .Select(root => BuildOrgUnitTreeNode(root, childrenByParentId, orgLookup, directMemberCounts, totalMemberCounts, structureInfo.PublishedStructureVersion, 0, normalizedMaxDepth))
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
                    employee.StableEmployeeKey,
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
        IReadOnlyDictionary<Guid, int> directMemberCounts,
        IReadOnlyDictionary<Guid, int> totalMemberCounts,
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
                .Select(child => BuildOrgUnitTreeNode(child, childrenByParentId, orgLookup, directMemberCounts, totalMemberCounts, publishedStructureVersion, depth + 1, maxDepth))
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
            directMemberCounts.GetValueOrDefault(orgUnit.Id, 0),
            totalMemberCounts.GetValueOrDefault(orgUnit.Id, 0),
            children);
    }

    private async Task<IReadOnlyDictionary<Guid, WorkforceAccountStatusDto>> LoadWorkforceAccountStatusesAsync(
        IReadOnlyCollection<Employee> employees,
        CancellationToken cancellationToken)
    {
        if (employees.Count == 0)
        {
            return new Dictionary<Guid, WorkforceAccountStatusDto>();
        }

        return await workforceAccountStatusReader.GetStatusesAsync(
            employees.Select(employee => new WorkforceAccountSubjectDto(
                employee.Id,
                employee.Email,
                employee.FirstName,
                employee.LastName)).ToList(),
            cancellationToken);
    }

    private async Task<(List<Employee> Employees, IReadOnlyDictionary<Guid, WorkforceAccountStatusDto> Statuses)>
        LoadMatchingAccessSubjectEmployeesAsync(
            string? search,
            string? access,
            Guid? profileId,
            string? employeeStatus,
            string? deliveryState,
            string? employeeKey,
            CancellationToken cancellationToken)
    {
        var query = ApplyAccessSubjectFilters(
            dbContext.Employees
                .AsNoTracking()
                .AsQueryable(),
            search,
            employeeStatus,
            employeeKey);
        var normalizedAccess = NormalizeAccessFilter(access);
        var normalizedDeliveryState = NormalizeDeliveryStateFilter(deliveryState);
        var requiresAccountFiltering =
            normalizedAccess is not null
            || profileId.HasValue
            || normalizedDeliveryState is not null;

        var candidateEmployees = await query
            .OrderBy(current => current.LastName)
            .ThenBy(current => current.FirstName)
            .ToListAsync(cancellationToken);

        var statuses = await LoadWorkforceAccountStatusesAsync(candidateEmployees, cancellationToken);
        if (requiresAccountFiltering)
        {
            candidateEmployees = candidateEmployees
                .Where(employee => MatchesAccessFilters(
                    statuses.GetValueOrDefault(employee.Id),
                    normalizedAccess,
                    profileId,
                    normalizedDeliveryState))
                .ToList();
        }

        return (candidateEmployees, statuses);
    }

    private async Task<IReadOnlyList<WorkforceAccessSubjectSummaryDto>> BuildAccessSubjectSummariesAsync(
        IReadOnlyCollection<Employee> employees,
        IReadOnlyDictionary<Guid, WorkforceAccountStatusDto> statuses,
        CancellationToken cancellationToken)
    {
        if (employees.Count == 0)
        {
            return [];
        }

        var directReportCounts = await LoadDirectReportCountsAsync(
            employees.Select(employee => employee.Id).ToList(),
            cancellationToken);

        return employees
            .Select(employee => BuildAccessSubjectSummary(
                employee,
                statuses.GetValueOrDefault(employee.Id),
                directReportCounts.GetValueOrDefault(employee.Id)))
            .ToList();
    }

    private static IQueryable<Employee> ApplyAccessSubjectFilters(
        IQueryable<Employee> query,
        string? search,
        string? employeeStatus,
        string? employeeKey)
    {
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

        if (!string.IsNullOrWhiteSpace(employeeKey))
        {
            var normalizedEmployeeKey = employeeKey.Trim();
            query = query.Where(current => current.StableEmployeeKey == normalizedEmployeeKey);
        }

        if (TryParseEmployeeStatusFilter(employeeStatus, out var statusFilter))
        {
            query = query.Where(current => current.Status == statusFilter);
        }

        return query;
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
            .Where(employee => employee.ManagerId.HasValue
                && employee.Status == EmployeeStatus.Active
                && employeeIds.Contains(employee.ManagerId.Value))
            .GroupBy(employee => employee.ManagerId!.Value)
            .Select(group => new { ManagerId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(group => group.ManagerId, group => group.Count, cancellationToken);
    }

    private WorkforceAccessSubjectSummaryDto BuildAccessSubjectSummary(
        Employee employee,
        WorkforceAccountStatusDto? account,
        int directReportCount)
    {
        var accessState = ClassifyAccessState(account);

        return new WorkforceAccessSubjectSummaryDto(
            employee.Id,
            employee.StableEmployeeKey,
            employee.EmployeeNumber,
            employee.FirstName,
            employee.LastName,
            employee.PreferredName,
            employee.DisplayName,
            employee.Email,
            employee.Status.ToString(),
            employee.Status == EmployeeStatus.Active,
            directReportCount,
            accessState,
            GetAccessStateLabel(accessState),
            GetAccessStateDetail(account),
            account?.AccessProfiles
                .Select(profile => new WorkforceAccessProfileSummaryDto(profile.Id, profile.Name))
                .ToList()
                ?? [],
            GetInvitationLabel(account),
            GetLastActivityLabel(account),
            GetLastActivityAt(account),
            account?.DeliveryStatus,
            GetReviewReason(account),
            account?.ProvisioningState ?? "Unprovisioned",
            account?.UserId);
    }

    private static string ClassifyAccessState(WorkforceAccountStatusDto? account)
    {
        if (account is null || string.Equals(account.ProvisioningState, "Unprovisioned", StringComparison.OrdinalIgnoreCase))
        {
            return AccessStateNotInvited;
        }

        if (string.Equals(account.ProvisioningState, "Active", StringComparison.OrdinalIgnoreCase))
        {
            return AccessStateActiveAccount;
        }

        if (string.Equals(account.ProvisioningState, "InvitePending", StringComparison.OrdinalIgnoreCase)
            && account.AccessProfiles.Count > 0)
        {
            return AccessStateInvitePending;
        }

        return AccessStateNeedsReview;
    }

    private static string GetAccessStateLabel(string accessState)
    {
        return accessState switch
        {
            AccessStateNotInvited => "Not invited",
            AccessStateInvitePending => "Invite pending",
            AccessStateActiveAccount => "Active account",
            _ => "Needs review",
        };
    }

    private static string? GetAccessStateDetail(WorkforceAccountStatusDto? account)
    {
        if (account is null)
        {
            return null;
        }

        if (!string.Equals(
                ClassifyAccessState(account),
                AccessStateNeedsReview,
                StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return GetReviewReason(account);
    }

    private static string GetInvitationLabel(WorkforceAccountStatusDto? account)
    {
        if (account is null || string.Equals(account.ProvisioningState, "Unprovisioned", StringComparison.OrdinalIgnoreCase))
        {
            return "Not sent";
        }

        if (string.Equals(account.ProvisioningState, "InvitePending", StringComparison.OrdinalIgnoreCase))
        {
            return "Pending";
        }

        return account.ProvisioningState switch
        {
            "InviteExpired" => "Expired",
            "InviteRevoked" => "Revoked",
            "InviteAccepted" => "Accepted",
            "Active" => "Accepted",
            _ => GetIssueSummary(account),
        };
    }

    private static string GetLastActivityLabel(WorkforceAccountStatusDto? account)
    {
        if (account?.LastLoginAt is not null)
            return FormatDateLabel(account.LastLoginAt, "Activated");

        return "No activity";
    }

    private static DateTime? GetLastActivityAt(WorkforceAccountStatusDto? account)
        => account?.LastLoginAt;

    private static string? GetReviewReason(WorkforceAccountStatusDto? account)
    {
        if (account is null)
        {
            return null;
        }

        if (account.Conflict is not null && !string.IsNullOrWhiteSpace(account.Conflict.Message))
        {
            return account.Conflict.Message;
        }

        if (string.Equals(account.ProvisioningState, "InvitePending", StringComparison.OrdinalIgnoreCase)
            && account.AccessProfiles.Count == 0)
        {
            return "Choose an access profile before continuing.";
        }

        return account.ProvisioningState switch
        {
            "Inactive" => "This account is inactive.",
            "InviteExpired" => "Invite expired",
            "InviteRevoked" => "Invitation revoked",
            "InviteAccepted" => "The invitation was accepted, but activation is not complete.",
            _ => null,
        };
    }

    private static string GetIssueSummary(WorkforceAccountStatusDto account)
    {
        if (account.Conflict is not null && !string.IsNullOrWhiteSpace(account.Conflict.Message))
        {
            return account.Conflict.Message;
        }

        return account.ProvisioningState switch
        {
            "Inactive" => "Account inactive",
            "InviteExpired" => "Invitation expired",
            "InviteRevoked" => "Invitation revoked",
            "InviteAccepted" => "Activation incomplete",
            _ => "Needs review",
        };
    }

    private static bool MatchesAccessFilters(
        WorkforceAccountStatusDto? account,
        string? access,
        Guid? profileId,
        string? deliveryState)
    {
        if (access is not null && !string.Equals(ClassifyAccessState(account), access, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (profileId.HasValue)
        {
            var hasProfile = account?.AccessProfiles.Any(profile => profile.Id == profileId.Value) == true;
            if (!hasProfile)
            {
                return false;
            }
        }

        if (deliveryState is not null
            && !string.Equals(account?.DeliveryStatus, deliveryState, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return true;
    }

    private static string? NormalizeAccessFilter(string? access)
    {
        if (string.IsNullOrWhiteSpace(access))
        {
            return null;
        }

        var normalized = access.Trim();
        return normalized switch
        {
            "NotInvited" => AccessStateNotInvited,
            "InvitePending" => AccessStateInvitePending,
            "ActiveAccount" => AccessStateActiveAccount,
            "NeedsReview" => AccessStateNeedsReview,
            _ => null,
        };
    }

    private static string? NormalizeDeliveryStateFilter(string? deliveryState)
    {
        if (string.IsNullOrWhiteSpace(deliveryState))
        {
            return null;
        }

        var normalized = deliveryState.Trim();
        return normalized is "Sent" or "Suppressed" or "Failed"
            ? normalized
            : null;
    }

    private static bool TryParseEmployeeStatusFilter(string? employeeStatus, out EmployeeStatus status)
    {
        status = default;

        if (string.IsNullOrWhiteSpace(employeeStatus))
        {
            return false;
        }

        if (!Enum.TryParse<EmployeeStatus>(employeeStatus.Trim(), true, out var parsedStatus))
        {
            return false;
        }

        status = parsedStatus;
        return true;
    }

    private static string FormatDateLabel(DateTime? value, string prefix)
    {
        if (!value.HasValue)
        {
            return prefix;
        }

        return $"{prefix} {value.Value:MMM d}";
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
    {
        var isPlatformAdmin = user.IsInRole(PlatformRole.PlatformAdmin);
        var isTenantReader = isPlatformAdmin
            || user.HasCorePermission(CorePermissions.EmployeeView, PermissionScopes.Tenant);
        var isDirectReportReader = !isTenantReader
            && (user.HasCorePermission(CorePermissions.TeamView, PermissionScopes.DirectReports)
                || user.HasCorePermission(CorePermissions.EmployeeView, PermissionScopes.DirectReports));

        return new WorkforceAccessContext(
            isTenantReader,
            isDirectReportReader,
            user.GetEmployeeId(),
            isTenantReader
                ? EmployeeReadAudience.HrAdmin
                : isDirectReportReader
                    ? EmployeeReadAudience.Manager
                    : EmployeeReadAudience.Employee);
    }

    private sealed record WorkforceAccessContext(
        bool IsHrAdmin,
        bool IsManager,
        Guid? LinkedEmployeeId,
        EmployeeReadAudience Audience);
}
