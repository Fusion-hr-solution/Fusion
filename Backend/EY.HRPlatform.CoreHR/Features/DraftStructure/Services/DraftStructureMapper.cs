using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Services;

public static class DraftStructureMapper
{
    public static DraftOrgUnitDto ToDto(
        DraftOrgUnit unit,
        DraftStructureSchemaDto schema,
        DraftOrgUnit? parent = null)
    {
        var orgUnitKindLabel = schema.OrgUnitKinds
            .FirstOrDefault(kind => kind.Key.Equals(unit.OrgUnitKindKey, StringComparison.OrdinalIgnoreCase))
            ?.DisplayLabel
            ?? unit.OrgUnitKindKey;

        return new DraftOrgUnitDto(
            unit.Id,
            unit.ReferenceKey,
            unit.DisplayName,
            unit.OrgUnitKindKey,
            orgUnitKindLabel,
            unit.Location,
            unit.Description,
            unit.ParentId,
            parent?.ReferenceKey,
            parent?.DisplayName,
            DraftStructureJsonSerializer.DeserializeAttributes(unit.AttributesJson),
            unit.CreatedAt,
            unit.UpdatedAt,
            unit.Version);
    }

    public static DraftStructureWorkspaceDto ToWorkspace(
        IReadOnlyCollection<DraftOrgUnit> units,
        DraftStructureSchemaDto schema)
    {
        var parents = units.ToDictionary(u => u.Id);
        var orderedUnits = units
            .OrderBy(u => u.DisplayName)
            .ThenBy(u => u.ReferenceKey)
            .Select(u => ToDto(
                u,
                schema,
                u.ParentId.HasValue && parents.TryGetValue(u.ParentId.Value, out var parent)
                    ? parent
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
            schema,
            orderedUnits);
    }
}