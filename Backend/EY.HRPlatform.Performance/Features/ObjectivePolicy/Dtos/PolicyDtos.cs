namespace EY.HRPlatform.Performance.Features.ObjectivePolicy.Dtos;

public sealed record ObjectivePlanningConfigurationDto(
    Guid Id,
    Guid ConfigurationId,
    bool IsConfigured,
    int MaxObjectiveCount,
    string AllowedWeights,
    bool QuantitativeEnabled,
    bool QualitativeEnabled,
    uint Version,
    Guid? SourceVersionId,
    Guid? SourceStartingConfigurationId,
    Guid CreatedByUserId,
    string? CreatedByName,
    DateTime? AppliedAt,
    string? ChangeSummary);

public sealed record ObjectivePlanningConfigurationOptionsDto(
    int MaxObjectiveCountLimit,
    string SupportedAllowedWeights,
    bool QuantitativeAvailable,
    bool QualitativeAvailable);

public sealed record ObjectivePlanningConfigurationSummaryDto(
    bool IsConfigured,
    ObjectivePlanningConfigurationDto? Configuration,
    ObjectivePlanningConfigurationOptionsDto? Options);

public sealed record ApplyObjectivePlanningConfigurationRequest(
    int MaxObjectiveCount,
    string AllowedWeights,
    bool QuantitativeEnabled,
    bool QualitativeEnabled,
    string? ChangeSummary = null);

public sealed record ValidateObjectivePlanningConfigurationRequest(
    int MaxObjectiveCount,
    string AllowedWeights,
    bool QuantitativeEnabled,
    bool QualitativeEnabled);

/// <summary>
/// Outcome of an Apply attempt. Mirrors the platform apply contract so both configuration
/// surfaces surface a blocked attempt the same way: <see cref="Applied"/> is false and
/// <see cref="Errors"/> carries the human-readable reasons, without persisting or throwing.
/// </summary>
public sealed record ObjectivePlanningConfigurationApplyResultDto(
    bool Applied,
    ObjectivePlanningConfigurationDto? Configuration,
    IReadOnlyList<string> Errors);
