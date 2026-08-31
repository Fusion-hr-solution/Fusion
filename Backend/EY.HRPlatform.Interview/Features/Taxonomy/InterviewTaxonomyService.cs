using System.Text.Json;
using EY.HRPlatform.Interview.Domain;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Taxonomy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Features.Taxonomy;

public class InterviewTaxonomyService(AppDbContext dbContext) : IInterviewTaxonomyService
{
    /// <summary>Singleton row id — same approach as CandidateAttemptSettings / CandidateRetentionSettings.</summary>
    private static readonly Guid TaxonomySettingsId = Guid.Parse("6d2b41c7-9f3a-4d18-8f52-1c0b7a5e9d34");

    private const int MaxLabelLength = 80;
    private const int MaxValueLength = 80;
    private const int MaxOpenListItems = 200;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<InterviewTaxonomyDto> GetAsync(CancellationToken cancellationToken)
    {
        var settings = await dbContext.InterviewTaxonomySettings
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == TaxonomySettingsId, cancellationToken);

        // No row yet is the normal state until someone edits — return defaults without writing.
        return InterviewTaxonomyMerger.Merge(settings?.OverridesJson, settings?.Version ?? 0);
    }

    public async Task<InterviewTaxonomyDto> SaveAsync(
        UpdateInterviewTaxonomyDto request,
        CancellationToken cancellationToken)
    {
        var incoming = Validate(request);

        var settings = await dbContext.InterviewTaxonomySettings
            .FirstOrDefaultAsync(item => item.Id == TaxonomySettingsId, cancellationToken);

        if (settings is null)
        {
            settings = new InterviewTaxonomySettings();
            // Force the singleton key without exposing a public setter on the entity.
            dbContext.Entry(settings).Property(item => item.Id).CurrentValue = TaxonomySettingsId;
            dbContext.InterviewTaxonomySettings.Add(settings);
        }

        // Partial update: overlay only the submitted keys onto whatever is already stored, so two
        // admins editing different sections do not overwrite each other.
        var stored = ReadOverrides(settings.OverridesJson);
        foreach (var (key, items) in incoming)
        {
            stored[key] = items;
        }

        settings.OverridesJson = JsonSerializer.Serialize(stored, JsonOptions);
        settings.Version++;

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Another request created the singleton first — reload and return that.
            dbContext.ChangeTracker.Clear();
            var reloaded = await dbContext.InterviewTaxonomySettings
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == TaxonomySettingsId, cancellationToken);
            if (reloaded is null)
            {
                throw;
            }

            return InterviewTaxonomyMerger.Merge(reloaded.OverridesJson, reloaded.Version);
        }

        return InterviewTaxonomyMerger.Merge(settings.OverridesJson, settings.Version);
    }

    /// <summary>
    /// Rejects anything that could produce an option the write path would refuse, or a list an
    /// author cannot use. Returns the trimmed, normalized payload.
    /// </summary>
    private static Dictionary<string, List<UpdateTaxonomyItemDto>> Validate(UpdateInterviewTaxonomyDto request)
    {
        var result = new Dictionary<string, List<UpdateTaxonomyItemDto>>(StringComparer.Ordinal);

        foreach (var (key, items) in request.Lists)
        {
            if (!InterviewTaxonomy.IsKnownKey(key))
            {
                throw new ApiException($"Unknown taxonomy list '{key}'.", StatusCodes.Status400BadRequest);
            }

            if (items is null || items.Count == 0)
            {
                throw new ApiException($"List '{key}' must contain at least one option.", StatusCodes.Status400BadRequest);
            }

            var locked = InterviewTaxonomy.IsLocked(key);

            if (!locked && items.Count > MaxOpenListItems)
            {
                throw new ApiException($"List '{key}' cannot exceed {MaxOpenListItems} options.", StatusCodes.Status400BadRequest);
            }

            var normalized = new List<UpdateTaxonomyItemDto>(items.Count);
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var item in items)
            {
                var value = item.Value?.Trim() ?? string.Empty;
                var label = item.Label?.Trim() ?? string.Empty;

                if (value.Length == 0)
                {
                    throw new ApiException($"A value is required for every option in '{key}'.", StatusCodes.Status400BadRequest);
                }

                if (value.Length > MaxValueLength)
                {
                    throw new ApiException($"Value '{value}' exceeds {MaxValueLength} characters.", StatusCodes.Status400BadRequest);
                }

                if (label.Length == 0)
                {
                    throw new ApiException($"A label is required for '{value}'.", StatusCodes.Status400BadRequest);
                }

                if (label.Length > MaxLabelLength)
                {
                    throw new ApiException($"Label for '{value}' exceeds {MaxLabelLength} characters.", StatusCodes.Status400BadRequest);
                }

                if (!seen.Add(value))
                {
                    throw new ApiException($"Duplicate value '{value}' in '{key}'.", StatusCodes.Status400BadRequest);
                }

                // The same check the write path applies, so Settings can never persist an option
                // that would 400 the moment an author picked it.
                if (locked && !InterviewTaxonomy.IsValidValue(key, value))
                {
                    throw new ApiException($"Invalid value '{value}' for '{key}'.", StatusCodes.Status400BadRequest);
                }

                normalized.Add(new UpdateTaxonomyItemDto { Value = value, Label = label, Hidden = item.Hidden });
            }

            if (locked)
            {
                var canonical = InterviewTaxonomy.DefaultsFor(key).Select(d => d.Value).ToHashSet(StringComparer.Ordinal);
                if (!seen.SetEquals(canonical))
                {
                    throw new ApiException(
                        $"Options cannot be added to or removed from '{key}' — it is fixed by the API contract. Rename, reorder or hide them instead.",
                        StatusCodes.Status400BadRequest);
                }
            }

            if (normalized.All(item => item.Hidden))
            {
                throw new ApiException($"At least one option in '{key}' must remain visible.", StatusCodes.Status400BadRequest);
            }

            result[key] = normalized;
        }

        return result;
    }

    private static Dictionary<string, List<UpdateTaxonomyItemDto>> ReadOverrides(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new Dictionary<string, List<UpdateTaxonomyItemDto>>(StringComparer.Ordinal);
        }

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, List<UpdateTaxonomyItemDto>>>(json, JsonOptions)
                   ?? new Dictionary<string, List<UpdateTaxonomyItemDto>>(StringComparer.Ordinal);
        }
        catch (JsonException)
        {
            return new Dictionary<string, List<UpdateTaxonomyItemDto>>(StringComparer.Ordinal);
        }
    }
}
