using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Services;

public static class DraftStructureRules
{
    private const string StructureCategory = "structure";
    private const string HierarchyCategory = "hierarchy";
    private const string UnitTypesCategory = "unitTypes";
    private const string RequiredDetailsCategory = "requiredDetails";

    public static async Task EnsureSetupActivatedAsync(
        CoreHRDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var setupState = await dbContext.TenantSetupStates
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (setupState is null || setupState.CurrentPhase == TenantSetupPhase.NotStarted)
        {
            throw new ArgumentException("Setup must be activated before managing draft structure.");
        }
    }

    public static async Task EnsureDraftEditableAsync(
        CoreHRDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var setupState = await dbContext.TenantSetupStates
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (setupState is null || setupState.CurrentPhase == TenantSetupPhase.NotStarted)
        {
            throw new ArgumentException("Setup must be activated before managing draft structure.");
        }

        if (setupState.CurrentPhase >= TenantSetupPhase.StructurallyGoverned)
        {
            throw new InvalidTenantSetupStateException(
                "Reopen the approved structure in Setup before changing the draft.");
        }
    }

    public static async Task<DraftSetupReadinessDto> EvaluateDraftReadinessAsync(
        CoreHRDbContext dbContext,
        CancellationToken cancellationToken)
    {
        await EnsureSetupActivatedAsync(dbContext, cancellationToken);

        var units = await dbContext.DraftOrgUnits
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var schema = await GetDraftStructureSchemaAsync(dbContext, cancellationToken);
        return EvaluateDraftReadiness(units, schema);
    }

    public static DraftSetupReadinessDto EvaluateDraftReadiness(
        IReadOnlyCollection<DraftOrgUnit> units,
        DraftStructureSchemaDto schema)
    {
        var blockingIssues = new List<DraftSetupIssueDto>();
        var warnings = new List<DraftSetupIssueDto>();
        var normalizedSchema = NormalizeDraftStructureSchema(schema);
        var lookup = units.ToDictionary(unit => unit.Id);
        var rootUnitCount = units.Count(unit => !unit.ParentId.HasValue);

        if (units.Count == 0)
        {
            blockingIssues.Add(CreateError(
                StructureCategory,
                "NO_UNITS",
                "Add at least one top-level unit before approval."));
        }

        if (units.Count > 0 && rootUnitCount == 0)
        {
            blockingIssues.Add(CreateError(
                StructureCategory,
                "NO_TOP_LEVEL_UNIT",
                "At least one top-level unit is required before approval."));
        }

        if (rootUnitCount > 1)
        {
            warnings.Add(CreateWarning(
                StructureCategory,
                "MULTIPLE_TOP_LEVEL_UNITS",
                "More than one top-level unit is planned. Confirm that this is intended."));
        }

        var duplicateReferenceKeyGroups = units
            .Where(unit => !string.IsNullOrWhiteSpace(unit.ReferenceKey))
            .GroupBy(unit => NormalizeReferenceKey(unit.ReferenceKey), StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1);

        foreach (var group in duplicateReferenceKeyGroups)
        {
            blockingIssues.Add(CreateError(
                StructureCategory,
                "DUPLICATE_REFERENCE_KEY",
                $"Unit code '{group.First().ReferenceKey}' is used more than once. Unit codes must stay unique.",
                null,
                "referenceKey"));
        }

        var validKindKeys = normalizedSchema.OrgUnitKinds
            .Select(kind => kind.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var unit in units)
        {
            var unitLabel = GetUnitLabel(unit);

            if (string.IsNullOrWhiteSpace(unit.ReferenceKey))
            {
                blockingIssues.Add(CreateError(
                    RequiredDetailsCategory,
                    "MISSING_REFERENCE_KEY",
                    $"{unitLabel} is missing a unit code.",
                    unit.Id,
                    "referenceKey"));
            }

            if (string.IsNullOrWhiteSpace(unit.DisplayName))
            {
                blockingIssues.Add(CreateError(
                    RequiredDetailsCategory,
                    "MISSING_DISPLAY_NAME",
                    $"{unitLabel} is missing a unit name.",
                    unit.Id,
                    "displayName"));
            }

            if (string.IsNullOrWhiteSpace(unit.OrgUnitKindKey))
            {
                blockingIssues.Add(CreateError(
                    UnitTypesCategory,
                    "MISSING_ORG_UNIT_KIND",
                    $"{unitLabel} is missing a unit type.",
                    unit.Id,
                    "orgUnitKindKey"));
            }
            else if (!validKindKeys.Contains(NormalizeKindKey(unit.OrgUnitKindKey)))
            {
                blockingIssues.Add(CreateError(
                    UnitTypesCategory,
                    "INVALID_ORG_UNIT_KIND",
                    $"{unitLabel} uses a unit type that is no longer available.",
                    unit.Id,
                    "orgUnitKindKey"));
            }

            if (unit.ParentId.HasValue && !lookup.ContainsKey(unit.ParentId.Value))
            {
                blockingIssues.Add(CreateError(
                    HierarchyCategory,
                    "INVALID_PARENT_REFERENCE",
                    $"{unitLabel} points to a parent that is no longer present in the draft.",
                    unit.Id,
                    "parentId"));
            }

            if (WouldCreateCycle(unit, lookup))
            {
                blockingIssues.Add(CreateError(
                    HierarchyCategory,
                    "CIRCULAR_HIERARCHY",
                    $"{unitLabel} creates a circular reporting line. Move it under a different parent.",
                    unit.Id,
                    "parentId"));
            }

            if (!string.IsNullOrWhiteSpace(unit.OrgUnitKindKey)
                && validKindKeys.Contains(NormalizeKindKey(unit.OrgUnitKindKey)))
            {
                try
                {
                    ValidateAndNormalizeAttributes(
                        normalizedSchema,
                        unit.OrgUnitKindKey,
                        DraftStructureJsonSerializer.DeserializeAttributes(unit.AttributesJson));
                }
                catch (ArgumentException ex)
                {
                    blockingIssues.Add(CreateError(
                        RequiredDetailsCategory,
                        "INVALID_ATTRIBUTES",
                        $"{unitLabel}: {ex.Message}",
                        unit.Id,
                        "attributes"));
                }
            }
        }

        return new DraftSetupReadinessDto(
            blockingIssues.Count == 0,
            units.Count,
            rootUnitCount,
            blockingIssues.Count,
            warnings.Count,
            OrderIssues(blockingIssues),
            OrderIssues(warnings));
    }

    public static async Task<DraftStructureSchemaDto> GetDraftStructureSchemaAsync(
        CoreHRDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var settings = await dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        var mergedSettings = TenantSettingsMerger.Merge(settings?.SettingsOverrides, settings?.Version);
        return NormalizeDraftStructureSchema(mergedSettings.DraftStructureSchema);
    }

    public static async Task<Dictionary<string, string>> GetOrgUnitKindLabelLookupAsync(
        CoreHRDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var schema = await GetDraftStructureSchemaAsync(dbContext, cancellationToken);
        return CreateOrgUnitKindLabelLookup(schema);
    }

    public static DraftStructureSchemaDto NormalizeDraftStructureSchema(DraftStructureSchemaDto? schema)
    {
        var sourceSchema = schema ?? DraftStructureSchemaDto.Defaults;
        var orgUnitKinds = sourceSchema.OrgUnitKinds
            .Where(kind => !string.IsNullOrWhiteSpace(kind.Key))
            .Select(kind => new OrgUnitKindDto(
                NormalizeKindKey(kind.Key),
                string.IsNullOrWhiteSpace(kind.DisplayLabel)
                    ? kind.Key.Trim()
                    : kind.DisplayLabel.Trim()))
            .Where(kind => !string.IsNullOrWhiteSpace(kind.Key) && !string.IsNullOrWhiteSpace(kind.DisplayLabel))
            .GroupBy(kind => kind.Key, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .ToList();

        if (orgUnitKinds.Count == 0)
        {
            orgUnitKinds = DraftStructureSchemaDto.DefaultOrgUnitKinds
                .Select(kind => new OrgUnitKindDto(kind.Key, kind.DisplayLabel))
                .ToList();
        }

        var attributes = sourceSchema.Attributes
            .Where(attribute =>
                !string.IsNullOrWhiteSpace(attribute.Key)
                && !string.IsNullOrWhiteSpace(attribute.DisplayLabel)
                && !string.IsNullOrWhiteSpace(attribute.ValueType))
            .Select(attribute => new DraftStructureAttributeDefinitionDto(
                attribute.Key.Trim(),
                attribute.DisplayLabel.Trim(),
                attribute.ValueType.Trim(),
                attribute.Required,
                attribute.AppliesToKindKeys?
                    .Where(kindKey => !string.IsNullOrWhiteSpace(kindKey))
                    .Select(NormalizeKindKey)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList(),
                attribute.AllowedValues?
                    .Where(value => !string.IsNullOrWhiteSpace(value))
                    .Select(value => value.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList()))
            .GroupBy(attribute => attribute.Key, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .ToList();

        return new DraftStructureSchemaDto
        {
            OrgUnitKinds = orgUnitKinds,
            Attributes = attributes
        };
    }

    public static Dictionary<string, string> CreateOrgUnitKindLabelLookup(DraftStructureSchemaDto schema)
    {
        var normalizedSchema = NormalizeDraftStructureSchema(schema);
        var labels = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var kind in normalizedSchema.OrgUnitKinds)
        {
            if (labels.ContainsKey(kind.Key))
                continue;

            labels[kind.Key] = kind.DisplayLabel;
        }

        return labels;
    }

    public static async Task ValidateOrgUnitKindAsync(
        CoreHRDbContext dbContext,
        string orgUnitKindKey,
        CancellationToken cancellationToken)
    {
        var schema = await GetDraftStructureSchemaAsync(dbContext, cancellationToken);
        ValidateOrgUnitKind(schema, orgUnitKindKey);
    }

    public static void ValidateOrgUnitKind(
        DraftStructureSchemaDto schema,
        string orgUnitKindKey)
    {
        var normalizedSchema = NormalizeDraftStructureSchema(schema);
        var normalizedKey = NormalizeKindKey(orgUnitKindKey);

        if (!normalizedSchema.OrgUnitKinds.Any(kind => kind.Key.Equals(normalizedKey, StringComparison.OrdinalIgnoreCase)))
        {
            throw new ArgumentException(
                $"Invalid org unit kind '{orgUnitKindKey}'. Valid kinds are: {string.Join(", ", normalizedSchema.OrgUnitKinds.Select(kind => kind.DisplayLabel))}");
        }
    }

    public static async Task<string?> ValidateAndNormalizeAttributesAsync(
        CoreHRDbContext dbContext,
        string orgUnitKindKey,
        Dictionary<string, object?>? attributes,
        CancellationToken cancellationToken)
    {
        var schema = await GetDraftStructureSchemaAsync(dbContext, cancellationToken);
        return ValidateAndNormalizeAttributes(schema, orgUnitKindKey, attributes);
    }

    public static string? ValidateAndNormalizeAttributes(
        DraftStructureSchemaDto schema,
        string orgUnitKindKey,
        Dictionary<string, object?>? attributes)
    {
        if (attributes is null || attributes.Count == 0)
            return null;

        var normalizedSchema = NormalizeDraftStructureSchema(schema);
        var normalizedKindKey = NormalizeKindKey(orgUnitKindKey);
        var attributeDefinitions = CreateAttributeDefinitionLookup(normalizedSchema);
        var normalizedAttributes = new JsonObject();

        foreach (var (attributeKey, rawValue) in attributes)
        {
            if (!attributeDefinitions.TryGetValue(attributeKey, out var attributeDefinition))
            {
                throw new ArgumentException($"Unknown draft-structure attribute '{attributeKey}'.");
            }

            if (!AttributeAppliesToKind(attributeDefinition, normalizedKindKey))
            {
                throw new ArgumentException(
                    $"Attribute '{attributeKey}' does not apply to org unit kind '{normalizedKindKey}'.");
            }

            normalizedAttributes[attributeDefinition.Key] = NormalizeAttributeValue(attributeDefinition, rawValue);
        }

        foreach (var attributeDefinition in normalizedSchema.Attributes.Where(attribute => attribute.Required))
        {
            if (!AttributeAppliesToKind(attributeDefinition, normalizedKindKey))
                continue;

            if (!normalizedAttributes.ContainsKey(attributeDefinition.Key) || normalizedAttributes[attributeDefinition.Key] is null)
            {
                throw new ArgumentException($"Attribute '{attributeDefinition.Key}' is required for org unit kind '{normalizedKindKey}'.");
            }
        }

        return normalizedAttributes.Count == 0
            ? null
            : normalizedAttributes.ToJsonString();
    }

    public static async Task<bool> WouldCreateCycleAsync(
        CoreHRDbContext dbContext,
        Guid draftOrgUnitId,
        Guid newParentId,
        CancellationToken cancellationToken)
    {
        var visited = new HashSet<Guid> { draftOrgUnitId };
        var current = newParentId;

        while (true)
        {
            if (visited.Contains(current))
            {
                return true;
            }

            visited.Add(current);

            var parentId = await dbContext.DraftOrgUnits
                .Where(o => o.Id == current)
                .Select(o => o.ParentId)
                .FirstOrDefaultAsync(cancellationToken);

            if (!parentId.HasValue)
            {
                return false;
            }

            current = parentId.Value;
        }
    }

    public static bool IsUniqueConstraintViolation(DbUpdateException ex)
    {
        return ex.InnerException?.Message.Contains("23505") == true
            || ex.InnerException?.Message.Contains("unique constraint") == true
            || ex.InnerException?.Message.Contains("duplicate key") == true;
    }

    public static string NormalizeReferenceKey(string value)
        => value.Trim().ToUpperInvariant();

    public static string NormalizeKindKey(string value)
        => value.Trim().ToLowerInvariant();

    private static bool WouldCreateCycle(
        DraftOrgUnit unit,
        IReadOnlyDictionary<Guid, DraftOrgUnit> lookup)
    {
        var visited = new HashSet<Guid> { unit.Id };
        var currentParentId = unit.ParentId;

        while (currentParentId.HasValue)
        {
            if (!lookup.TryGetValue(currentParentId.Value, out var parent))
            {
                return false;
            }

            if (!visited.Add(parent.Id))
            {
                return true;
            }

            currentParentId = parent.ParentId;
        }

        return false;
    }

    private static string GetUnitLabel(DraftOrgUnit unit)
    {
        if (!string.IsNullOrWhiteSpace(unit.DisplayName))
            return $"'{unit.DisplayName}'";

        if (!string.IsNullOrWhiteSpace(unit.ReferenceKey))
            return $"Unit '{unit.ReferenceKey}'";

        return "This unit";
    }

    private static List<DraftSetupIssueDto> OrderIssues(IEnumerable<DraftSetupIssueDto> issues)
        => issues
            .OrderBy(issue => issue.Category, StringComparer.OrdinalIgnoreCase)
            .ThenBy(issue => issue.Message, StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static DraftSetupIssueDto CreateError(
        string category,
        string code,
        string message,
        Guid? unitId = null,
        string? field = null)
        => new("error", category, code, message, unitId, field);

    private static DraftSetupIssueDto CreateWarning(
        string category,
        string code,
        string message,
        Guid? unitId = null,
        string? field = null)
        => new("warning", category, code, message, unitId, field);

    private static bool AttributeAppliesToKind(
        DraftStructureAttributeDefinitionDto attributeDefinition,
        string normalizedKindKey)
    {
        return attributeDefinition.AppliesToKindKeys is not { Count: > 0 }
            || attributeDefinition.AppliesToKindKeys.Any(kind =>
                kind.Equals(normalizedKindKey, StringComparison.OrdinalIgnoreCase));
    }

    private static Dictionary<string, DraftStructureAttributeDefinitionDto> CreateAttributeDefinitionLookup(
        DraftStructureSchemaDto schema)
    {
        var lookup = new Dictionary<string, DraftStructureAttributeDefinitionDto>(StringComparer.OrdinalIgnoreCase);

        foreach (var attribute in schema.Attributes)
        {
            if (lookup.ContainsKey(attribute.Key))
                continue;

            lookup[attribute.Key] = attribute;
        }

        return lookup;
    }

    private static JsonNode? NormalizeAttributeValue(
        DraftStructureAttributeDefinitionDto attributeDefinition,
        object? rawValue)
    {
        if (rawValue is null)
            return null;

        return attributeDefinition.ValueType switch
        {
            "text" => JsonValue.Create(ReadStringValue(rawValue, attributeDefinition.Key)),
            "number" => JsonValue.Create(ReadNumberValue(rawValue, attributeDefinition.Key)),
            "boolean" => JsonValue.Create(ReadBooleanValue(rawValue, attributeDefinition.Key)),
            "date" => JsonValue.Create(ReadDateValue(rawValue, attributeDefinition.Key)),
            "singleSelect" => JsonValue.Create(ReadSingleSelectValue(rawValue, attributeDefinition)),
            _ => throw new ArgumentException(
                $"Unsupported attribute value type '{attributeDefinition.ValueType}' for attribute '{attributeDefinition.Key}'.")
        };
    }

    private static string ReadStringValue(object rawValue, string attributeKey)
    {
        var value = ReadString(rawValue)?.Trim();
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException($"Attribute '{attributeKey}' must be a non-empty text value.");

        return value;
    }

    private static decimal ReadNumberValue(object rawValue, string attributeKey)
    {
        if (rawValue is JsonElement jsonElement)
        {
            if (jsonElement.ValueKind == System.Text.Json.JsonValueKind.Number && jsonElement.TryGetDecimal(out var decimalValue))
                return decimalValue;

            if (jsonElement.ValueKind == System.Text.Json.JsonValueKind.String &&
                decimal.TryParse(jsonElement.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out decimalValue))
                return decimalValue;
        }

        if (rawValue is decimal decimalRaw)
            return decimalRaw;

        if (rawValue is int intRaw)
            return intRaw;

        if (rawValue is long longRaw)
            return longRaw;

        if (rawValue is double doubleRaw)
            return Convert.ToDecimal(doubleRaw, CultureInfo.InvariantCulture);

        if (decimal.TryParse(ReadString(rawValue), NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed))
            return parsed;

        throw new ArgumentException($"Attribute '{attributeKey}' must be a numeric value.");
    }

    private static bool ReadBooleanValue(object rawValue, string attributeKey)
    {
        if (rawValue is JsonElement jsonElement)
        {
            if (jsonElement.ValueKind == System.Text.Json.JsonValueKind.True)
                return true;

            if (jsonElement.ValueKind == System.Text.Json.JsonValueKind.False)
                return false;

            if (jsonElement.ValueKind == System.Text.Json.JsonValueKind.String &&
                bool.TryParse(jsonElement.GetString(), out var booleanValue))
                return booleanValue;
        }

        if (rawValue is bool booleanRaw)
            return booleanRaw;

        if (bool.TryParse(ReadString(rawValue), out var parsed))
            return parsed;

        throw new ArgumentException($"Attribute '{attributeKey}' must be a boolean value.");
    }

    private static string ReadDateValue(object rawValue, string attributeKey)
    {
        var rawString = ReadString(rawValue);

        if (DateOnly.TryParse(rawString, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dateOnly))
            return dateOnly.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        if (DateTime.TryParse(rawString, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var dateTime))
            return dateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        throw new ArgumentException($"Attribute '{attributeKey}' must be a valid date value.");
    }

    private static string ReadSingleSelectValue(
        object rawValue,
        DraftStructureAttributeDefinitionDto attributeDefinition)
    {
        var value = ReadStringValue(rawValue, attributeDefinition.Key);
        var allowedValues = attributeDefinition.AllowedValues ?? [];

        if (allowedValues.Count == 0)
            return value;

        var matched = allowedValues.FirstOrDefault(candidate =>
            candidate.Equals(value, StringComparison.OrdinalIgnoreCase));

        if (matched is null)
        {
            throw new ArgumentException(
                $"Attribute '{attributeDefinition.Key}' must match one of: {string.Join(", ", allowedValues)}.");
        }

        return matched;
    }

    private static string? ReadString(object rawValue)
    {
        return rawValue switch
        {
            string stringValue => stringValue,
            JsonElement jsonElement when jsonElement.ValueKind == System.Text.Json.JsonValueKind.String => jsonElement.GetString(),
            JsonElement jsonElement => jsonElement.ToString(),
            _ => rawValue.ToString()
        };
    }
}