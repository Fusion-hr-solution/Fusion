using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities.Platform;

/// <summary>
/// Platform-managed template copied to new tenants on provisioning.
/// Not tenant-scoped. Platform admins manage the active set.
/// </summary>
public class PlatformStarterTemplate : BaseEntity
{
    private PlatformStarterTemplate() { }

    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string MeasurementType { get; private set; } = "Qualitative";
    public decimal? SuggestedWeighting { get; private set; }
    public string? Tags { get; private set; }
    public decimal? TargetValue { get; private set; }
    public string? Unit { get; private set; }
    public string? SuccessCriteria { get; private set; }
    public bool IsActive { get; private set; } = true;
    public int SortOrder { get; private set; }

    public static PlatformStarterTemplate Create(
        string title,
        string? description,
        string measurementType,
        decimal? suggestedWeighting,
        string? tags,
        decimal? targetValue,
        string? unit,
        string? successCriteria,
        int sortOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title cannot be empty.", nameof(title));
        if (measurementType is not ("Quantitative" or "Qualitative"))
            throw new ArgumentException($"Unknown measurement type '{measurementType}'.", nameof(measurementType));

        return new PlatformStarterTemplate
        {
            Id = Guid.NewGuid(),
            Title = title.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            MeasurementType = measurementType,
            SuggestedWeighting = suggestedWeighting,
            Tags = string.IsNullOrWhiteSpace(tags) ? null : tags.Trim(),
            TargetValue = targetValue,
            Unit = string.IsNullOrWhiteSpace(unit) ? null : unit.Trim(),
            SuccessCriteria = string.IsNullOrWhiteSpace(successCriteria) ? null : successCriteria.Trim(),
            IsActive = true,
            SortOrder = sortOrder,
        };
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
