using System.Text.Json;
using EY.HRPlatform.Interview.Domain;
using EY.HRPlatform.Interview.Features.Grading.Judge0;
using EY.HRPlatform.Interview.Models.Taxonomy;

namespace EY.HRPlatform.Interview.Features.Taxonomy;

/// <summary>
/// Merges the admin's stored overrides over the canonical catalogue. Pure and static so it can be
/// unit-tested without a DbContext.
/// </summary>
/// <remarks>
/// The asymmetry between the two kinds of list is the whole safety story:
///
/// <b>Locked lists</b> can only be relabelled, reordered and hidden. Any override value that is not
/// in the catalogue is dropped (a stale blob after an enum member is removed), and any catalogue
/// value the override is missing is appended unhidden. So a locked list can never lose a canonical
/// value, and a newly added enum member appears with no data migration.
///
/// <b>Open lists</b> are replaced wholesale by the override, so a deleted language stays deleted
/// rather than being resurrected by the seed on every read.
/// </remarks>
public static class InterviewTaxonomyMerger
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static InterviewTaxonomyDto Merge(string? overridesJson, int version)
    {
        var overrides = ReadOverrides(overridesJson);
        var result = new InterviewTaxonomyDto { Version = version };

        foreach (var key in InterviewTaxonomy.Keys)
        {
            overrides.TryGetValue(key, out var stored);
            result.Lists[key] = new TaxonomyListDto
            {
                Key = key,
                Locked = InterviewTaxonomy.IsLocked(key),
                Items = MergeList(key, stored),
            };
        }

        return result;
    }

    private static List<TaxonomyItemDto> MergeList(string key, List<UpdateTaxonomyItemDto>? stored)
    {
        var defaults = InterviewTaxonomy.DefaultsFor(key);
        var locked = InterviewTaxonomy.IsLocked(key);

        List<TaxonomyItemDto> items;

        if (stored is null)
        {
            items = [.. defaults.Select(d => ToItem(key, d.Value, d.Label, hidden: false))];
        }
        else if (locked)
        {
            var byValue = defaults.ToDictionary(d => d.Value, StringComparer.Ordinal);

            // Keep the admin's order, but only for values that still exist in the catalogue.
            items =
            [
                .. stored
                    .Where(item => byValue.ContainsKey(item.Value))
                    .Select(item => ToItem(key, item.Value, item.Label, item.Hidden)),
            ];

            // Anything the override never mentioned — including a brand-new enum member — is
            // appended rather than silently lost.
            var present = items.Select(i => i.Value).ToHashSet(StringComparer.Ordinal);
            items.AddRange(defaults
                .Where(d => !present.Contains(d.Value))
                .Select(d => ToItem(key, d.Value, d.Label, hidden: false)));
        }
        else
        {
            items = [.. stored.Select(item => ToItem(key, item.Value, item.Label, item.Hidden))];
        }

        // A list where everything is hidden would leave an author with an empty dropdown and no way
        // back. Validation rejects it on save; this is the belt-and-braces for an already-bad row.
        if (items.Count > 0 && items.All(i => i.Hidden))
            items[0].Hidden = false;

        return items;
    }

    private static TaxonomyItemDto ToItem(string key, string value, string? label, bool hidden)
    {
        var defaults = InterviewTaxonomy.DefaultsFor(key);
        var canonical = defaults.FirstOrDefault(d => string.Equals(d.Value, value, StringComparison.Ordinal));
        var resolvedLabel = string.IsNullOrWhiteSpace(label) ? (canonical?.Label ?? value) : label.Trim();

        return new TaxonomyItemDto
        {
            Value = value,
            Label = resolvedLabel,
            Hidden = hidden,
            IsDefault = canonical is not null && string.Equals(canonical.Label, resolvedLabel, StringComparison.Ordinal),
            SupportsAutoGrading = key == InterviewTaxonomy.CodingLanguages
                ? Judge0LanguageMap.IsSupported(value)
                : null,
        };
    }

    /// <summary>A corrupt blob degrades to "no overrides" rather than a 500.</summary>
    private static Dictionary<string, List<UpdateTaxonomyItemDto>> ReadOverrides(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return [];

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, List<UpdateTaxonomyItemDto>>>(json, JsonOptions)
                   ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
