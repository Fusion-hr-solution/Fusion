using System.Text.Json;
using System.Text.Json.Nodes;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Services;

/// <summary>
/// Builds the JSONB override string from update requests.
/// Complements TenantSettingsMerger (read-side) with write-side logic.
/// </summary>
public static class TenantSettingsOverrideBuilder
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    /// <summary>
    /// Builds a new override JSON string by merging the update request into existing overrides.
    /// Returns null if the result would be empty (no overrides needed).
    /// </summary>
    public static string? Build(
        string? existingOverridesJson,
        List<string>? orgUnitTypes,
        Dictionary<string, FieldConfigInput>? employeeFieldConfig,
        BrandingSettingsInput? branding)
    {
        // Start from existing overrides or empty object
        var root = string.IsNullOrWhiteSpace(existingOverridesJson)
            ? new JsonObject()
            : JsonNode.Parse(existingOverridesJson)?.AsObject() ?? new JsonObject();

        // Update orgUnitTypes if provided
        if (orgUnitTypes is not null)
        {
            root["orgUnitTypes"] = JsonSerializer.SerializeToNode(orgUnitTypes, JsonOptions);
        }

        // Merge employeeFieldConfig if provided
        if (employeeFieldConfig is not null)
        {
            var existing = root["employeeFieldConfig"]?.AsObject() ?? new JsonObject();
            foreach (var (key, value) in employeeFieldConfig)
            {
                // Skip if no values are provided
                if (!value.Visible.HasValue && !value.Required.HasValue &&
                    !value.VisibleToEmployee.HasValue && !value.VisibleToManager.HasValue)
                    continue;

                var fieldObj = existing[key]?.AsObject() ?? new JsonObject();

                if (value.Visible.HasValue)
                    fieldObj["visible"] = value.Visible.Value;
                if (value.Required.HasValue)
                    fieldObj["required"] = value.Required.Value;
                if (value.VisibleToEmployee.HasValue)
                    fieldObj["visibleToEmployee"] = value.VisibleToEmployee.Value;
                if (value.VisibleToManager.HasValue)
                    fieldObj["visibleToManager"] = value.VisibleToManager.Value;

                // Only add if we actually have properties
                if (fieldObj.Count > 0)
                    existing[key] = fieldObj;
            }

            // Only set employeeFieldConfig if it has content
            if (existing.Count > 0)
                root["employeeFieldConfig"] = existing;
        }

        // Merge branding if provided
        if (branding is not null)
        {
            var existing = root["branding"]?.AsObject() ?? new JsonObject();

            if (branding.LogoUrl is not null)
                existing["logoUrl"] = branding.LogoUrl;
            if (branding.PrimaryColor is not null)
                existing["primaryColor"] = branding.PrimaryColor;

            // Only set branding if it has content
            if (existing.Count > 0)
                root["branding"] = existing;
        }

        // Prune empty objects and return null if nothing remains
        PruneEmptyObjects(root);

        if (root.Count == 0)
            return null;

        return root.ToJsonString(JsonOptions);
    }

    /// <summary>
    /// Removes any top-level keys that are empty objects.
    /// </summary>
    private static void PruneEmptyObjects(JsonObject root)
    {
        var keysToRemove = root
            .Where(kvp => kvp.Value is JsonObject obj && obj.Count == 0)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in keysToRemove)
        {
            root.Remove(key);
        }
    }
}
