using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Services;

public static class DraftStructureMapper
{
    public static DraftOrgUnitDto ToDto(DraftOrgUnit unit, string? parentName = null) => new(
        unit.Id,
        unit.Code,
        unit.Name,
        unit.Type,
        unit.ParentId,
        parentName,
        unit.CreatedAt,
        unit.UpdatedAt,
        unit.Version);

    public static DraftStructureWorkspaceDto ToWorkspace(
        IReadOnlyCollection<DraftOrgUnit> units,
        IReadOnlyList<string> allowedTypes)
    {
        var parentNames = units.ToDictionary(u => u.Id, u => u.Name);
        var orderedUnits = units
            .OrderBy(u => u.Name)
            .ThenBy(u => u.Code)
            .Select(u => ToDto(
                u,
                u.ParentId.HasValue && parentNames.TryGetValue(u.ParentId.Value, out var parentName)
                    ? parentName
                    : null))
            .ToList();

        DateTime? lastModifiedAt = units.Count == 0
            ? null
            : units.Max(u => u.UpdatedAt ?? u.CreatedAt);

        return new DraftStructureWorkspaceDto(
            units.Count == 0 ? "empty" : "inProgress",
            units.Count,
            units.Count(u => !u.ParentId.HasValue),
            lastModifiedAt,
            allowedTypes.ToList(),
            orderedUnits);
    }
}