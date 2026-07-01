using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Queries.GetOrgUnitTree;

public sealed class GetOrgUnitTreeQueryHandler(
    CoreHRDbContext dbContext) : IQueryHandler<GetOrgUnitTreeQuery, Result<List<OrgUnitTreeNodeDto>>>
{
    public async Task<Result<List<OrgUnitTreeNodeDto>>> Handle(
        GetOrgUnitTreeQuery request,
        CancellationToken cancellationToken)
    {
        // Fetch all org units (filtered by active status)
        var query = dbContext.OrgUnits.AsNoTracking();

        if (!request.IncludeInactive)
        {
            query = query.Where(o => o.IsActive);
        }

        var allOrgUnits = await query.ToListAsync(cancellationToken);

        // Build lookup dictionary for efficient tree construction
        var lookup = allOrgUnits.ToDictionary(o => o.Id);
        var childrenMap = allOrgUnits
            .Where(o => o.ParentId.HasValue)
            .GroupBy(o => o.ParentId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Direct active-member count per unit + a full-subtree rollup computed over the entire
        // hierarchy (independent of the render maxDepth so truncated branches still count).
        var directMemberCounts = await dbContext.Employees
            .AsNoTracking()
            .Where(e => e.Status == EmployeeStatus.Active && e.OrgUnitId.HasValue)
            .GroupBy(e => e.OrgUnitId!.Value)
            .Select(g => new { OrgUnitId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.OrgUnitId, g => g.Count, cancellationToken);

        var totalMemberCounts = new Dictionary<Guid, int>();
        int ComputeTotal(OrgUnit unit)
        {
            if (totalMemberCounts.TryGetValue(unit.Id, out var cached))
            {
                return cached;
            }

            var total = directMemberCounts.GetValueOrDefault(unit.Id, 0);
            if (childrenMap.TryGetValue(unit.Id, out var kids))
            {
                total += kids.Sum(ComputeTotal);
            }
            totalMemberCounts[unit.Id] = total;
            return total;
        }
        foreach (var unit in allOrgUnits)
        {
            ComputeTotal(unit);
        }

        // Find root nodes: either nodes with no parent, or nodes whose parent is inactive/missing
        var roots = new List<(OrgUnit OrgUnit, bool IsOrphaned)>();

        foreach (var orgUnit in allOrgUnits)
        {
            if (!orgUnit.ParentId.HasValue)
            {
                // True root - no parent
                roots.Add((orgUnit, false));
            }
            else if (!lookup.ContainsKey(orgUnit.ParentId.Value))
            {
                // Orphan - parent not in current result set (missing or filtered out)
                roots.Add((orgUnit, true));
            }
        }

        // If a specific root ID is requested, filter to that subtree
        if (request.RootId.HasValue)
        {
            if (!lookup.TryGetValue(request.RootId.Value, out var rootOrgUnit))
            {
                // Root not found - return empty tree
                return Result.Success(new List<OrgUnitTreeNodeDto>());
            }

            var subtreeRoot = BuildTreeNode(rootOrgUnit, childrenMap, directMemberCounts, totalMemberCounts, 0, request.MaxDepth, false);
            return Result.Success(new List<OrgUnitTreeNodeDto> { subtreeRoot });
        }

        // Build tree from roots
        var tree = roots
            .Select(r => BuildTreeNode(r.OrgUnit, childrenMap, directMemberCounts, totalMemberCounts, 0, request.MaxDepth, r.IsOrphaned))
            .OrderBy(n => n.Name)
            .ToList();

        return Result.Success(tree);
    }

    private static OrgUnitTreeNodeDto BuildTreeNode(
        OrgUnit orgUnit,
        Dictionary<Guid, List<OrgUnit>> childrenMap,
        IReadOnlyDictionary<Guid, int> directMemberCounts,
        IReadOnlyDictionary<Guid, int> totalMemberCounts,
        int currentLevel,
        int maxDepth,
        bool isOrphaned)
    {
        var children = new List<OrgUnitTreeNodeDto>();

        if (currentLevel < maxDepth && childrenMap.TryGetValue(orgUnit.Id, out var childOrgUnits))
        {
            children = childOrgUnits
                .Select(child => BuildTreeNode(child, childrenMap, directMemberCounts, totalMemberCounts, currentLevel + 1, maxDepth, false))
                .OrderBy(c => c.Name)
                .ToList();
        }

        return new OrgUnitTreeNodeDto(
            orgUnit.Id,
            orgUnit.Code,
            orgUnit.Name,
            orgUnit.Type,
            currentLevel,
            isOrphaned,
            directMemberCounts.GetValueOrDefault(orgUnit.Id, 0),
            totalMemberCounts.GetValueOrDefault(orgUnit.Id, 0),
            children);
    }
}
