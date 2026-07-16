namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class CampaignPlanningRulesSnapshot
{
    private CampaignPlanningRulesSnapshot() { }

    public int MaxObjectiveCount { get; private set; }
    public string AllowedWeightMenu { get; private set; } = string.Empty;
    public string EnabledMeasurementMethods { get; private set; } = string.Empty;
    public Guid SourceConfigurationVersionId { get; private set; }
    public DateTime CapturedAt { get; private set; }

    public static CampaignPlanningRulesSnapshot Capture(
        int maxObjectiveCount,
        string allowedWeightMenu,
        string enabledMeasurementMethods,
        Guid sourceConfigurationVersionId,
        DateTime capturedAt)
    {
        if (maxObjectiveCount < 1)
            throw new ArgumentOutOfRangeException(nameof(maxObjectiveCount), "Maximum objective count must be at least one.");
        if (string.IsNullOrWhiteSpace(allowedWeightMenu))
            throw new ArgumentException("Allowed weight menu is required.", nameof(allowedWeightMenu));
        if (string.IsNullOrWhiteSpace(enabledMeasurementMethods))
            throw new ArgumentException("At least one measurement method is required.", nameof(enabledMeasurementMethods));
        if (sourceConfigurationVersionId == Guid.Empty)
            throw new ArgumentException("Source configuration version is required.", nameof(sourceConfigurationVersionId));

        return new CampaignPlanningRulesSnapshot
        {
            MaxObjectiveCount = maxObjectiveCount,
            AllowedWeightMenu = allowedWeightMenu.Trim(),
            EnabledMeasurementMethods = enabledMeasurementMethods.Trim(),
            SourceConfigurationVersionId = sourceConfigurationVersionId,
            CapturedAt = NormalizeUtc(capturedAt, nameof(capturedAt))
        };
    }

    private static DateTime NormalizeUtc(DateTime value, string paramName)
    {
        if (value == default)
            throw new ArgumentException("A valid date is required.", paramName);

        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}
