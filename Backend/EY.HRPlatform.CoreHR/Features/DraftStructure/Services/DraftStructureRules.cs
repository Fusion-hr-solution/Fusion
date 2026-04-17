using EY.HRPlatform.CoreHR.Domain.Entities;
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

    public static async Task<DraftStructureSchemaDto> GetDraftStructureSchemaAsync(
        CoreHRDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var settings = await dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        var mergedSettings = TenantSettingsMerger.Merge(settings?.SettingsOverrides, settings?.Version);
        return mergedSettings.DraftStructureSchema;
    }

    public static async Task<Dictionary<string, string>> GetOrgUnitKindLabelLookupAsync(
        CoreHRDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var schema = await GetDraftStructureSchemaAsync(dbContext, cancellationToken);
        return schema.OrgUnitKinds.ToDictionary(kind => kind.Key, kind => kind.DisplayLabel, StringComparer.OrdinalIgnoreCase);
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
        var normalizedKey = NormalizeKindKey(orgUnitKindKey);

        if (!schema.OrgUnitKinds.Any(kind => kind.Key.Equals(normalizedKey, StringComparison.OrdinalIgnoreCase)))
        {
            throw new ArgumentException(
                $"Invalid org unit kind '{orgUnitKindKey}'. Valid kinds are: {string.Join(", ", schema.OrgUnitKinds.Select(kind => kind.DisplayLabel))}");
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

        var normalizedKindKey = NormalizeKindKey(orgUnitKindKey);
        var attributeDefinitions = schema.Attributes.ToDictionary(attribute => attribute.Key, StringComparer.OrdinalIgnoreCase);
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

        foreach (var attributeDefinition in schema.Attributes.Where(attribute => attribute.Required))
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

    private static bool AttributeAppliesToKind(
        DraftStructureAttributeDefinitionDto attributeDefinition,
        string normalizedKindKey)
    {
        return attributeDefinition.AppliesToKindKeys is not { Count: > 0 }
            || attributeDefinition.AppliesToKindKeys.Any(kind =>
                kind.Equals(normalizedKindKey, StringComparison.OrdinalIgnoreCase));
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