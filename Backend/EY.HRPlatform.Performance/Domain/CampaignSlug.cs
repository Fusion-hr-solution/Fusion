using System.Globalization;
using System.Text;

namespace EY.HRPlatform.Performance.Domain;

/// <summary>
/// Builds the human-readable, tenant-unique URL identity for a campaign. The opaque
/// <see cref="Entities.PerformanceCycle.Id"/> remains the canonical key; the slug is a stable,
/// readable addressing surface (e.g. <c>annual-planning-2026</c>) generated once at creation.
/// </summary>
public static class CampaignSlug
{
    public const int MaxLength = 240;

    /// <summary>Base slug for a campaign, e.g. "Annual Planning" + 2026 → "annual-planning-2026".</summary>
    public static string From(string name, int referenceYear)
    {
        var stem = Slugify(name);
        return stem.Length == 0
            ? referenceYear.ToString(CultureInfo.InvariantCulture)
            : $"{stem}-{referenceYear}";
    }

    /// <summary>
    /// Resolves a collision-free slug within a tenant by appending an incrementing suffix
    /// (<c>-2</c>, <c>-3</c>, …) when the base is already taken.
    /// </summary>
    public static string Unique(string baseSlug, IEnumerable<string> existingSlugs)
    {
        var taken = new HashSet<string>(existingSlugs, StringComparer.OrdinalIgnoreCase);
        if (!taken.Contains(baseSlug))
        {
            return baseSlug;
        }

        for (var suffix = 2; ; suffix++)
        {
            var candidate = $"{baseSlug}-{suffix}";
            if (!taken.Contains(candidate))
            {
                return candidate;
            }
        }
    }

    /// <summary>Lower-cases, strips diacritics, and reduces to <c>[a-z0-9-]</c> with collapsed dashes.</summary>
    public static string Slugify(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var normalized = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        var atDashBoundary = false;

        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
            {
                continue; // drop accents left over from the FormD decomposition
            }

            if (ch is (>= 'a' and <= 'z') or (>= '0' and <= '9'))
            {
                if (atDashBoundary && builder.Length > 0)
                {
                    builder.Append('-');
                }

                builder.Append(ch);
                atDashBoundary = false;
            }
            else
            {
                atDashBoundary = true; // a run of separators collapses to a single dash
            }
        }

        var slug = builder.ToString();
        return slug.Length > MaxLength ? slug[..MaxLength].Trim('-') : slug;
    }
}
