using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Queries.GetDraftOrgUnitTree;

public sealed class GetDraftOrgUnitTreeQueryHandler(
    CoreHRDbContext dbContext) : IQueryHandler<GetDraftOrgUnitTreeQuery, List<DraftOrgUnitTreeNodeDto>>
{
    public async Task<List<DraftOrgUnitTreeNodeDto>> Handle(
        GetDraftOrgUnitTreeQuery request,
        CancellationToken cancellationToken)
    {
        await DraftStructureRules.EnsureSetupActivatedAsync(dbContext, cancellationToken);
        var kindLabels = await DraftStructureRules.GetOrgUnitKindLabelLookupAsync(dbContext, cancellationToken);

        var allUnits = await dbContext.DraftOrgUnits
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var lookup = allUnits.ToDictionary(o => o.Id);
        var childrenMap = allUnits
            .Where(o => o.ParentId.HasValue)
            .GroupBy(o => o.ParentId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var roots = new List<(DraftOrgUnit OrgUnit, bool IsOrphaned)>();

        foreach (var orgUnit in allUnits)
        {
            if (!orgUnit.ParentId.HasValue)
            {
                roots.Add((orgUnit, false));
            }
            else if (!lookup.ContainsKey(orgUnit.ParentId.Value))
            {
                roots.Add((orgUnit, true));
            }
        }

        if (request.RootId.HasValue)
        {
            if (!lookup.TryGetValue(request.RootId.Value, out var rootOrgUnit))
            {
                return new List<DraftOrgUnitTreeNodeDto>();
            }

            return new List<DraftOrgUnitTreeNodeDto>
            {
                BuildTreeNode(rootOrgUnit, childrenMap, kindLabels, 0, request.MaxDepth, false)
            };
        }

        return roots
            .Select(r => BuildTreeNode(r.OrgUnit, childrenMap, kindLabels, 0, request.MaxDepth, r.IsOrphaned))
            .OrderBy(n => n.DisplayName)
            .ToList();
    }

    private static DraftOrgUnitTreeNodeDto BuildTreeNode(
        DraftOrgUnit orgUnit,
        Dictionary<Guid, List<DraftOrgUnit>> childrenMap,
        Dictionary<string, string> kindLabels,
        int currentLevel,
        int maxDepth,
        bool isOrphaned)
    {
        var children = new List<DraftOrgUnitTreeNodeDto>();

        if (currentLevel < maxDepth && childrenMap.TryGetValue(orgUnit.Id, out var childOrgUnits))
        {
            children = childOrgUnits
                .Select(child => BuildTreeNode(child, childrenMap, kindLabels, currentLevel + 1, maxDepth, false))
                .OrderBy(c => c.DisplayName)
                .ToList();
        }

        return new DraftOrgUnitTreeNodeDto(
            orgUnit.Id,
            orgUnit.ReferenceKey,
            orgUnit.DisplayName,
            orgUnit.OrgUnitKindKey,
            kindLabels.TryGetValue(orgUnit.OrgUnitKindKey, out var orgUnitKindLabel)
                ? orgUnitKindLabel
                : orgUnit.OrgUnitKindKey,
            orgUnit.BusinessCode,
            currentLevel,
            isOrphaned,
            children);
    }
}