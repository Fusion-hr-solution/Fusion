namespace EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;

public sealed record PlatformPerformanceConfigurationDto(
    Guid Id,
    uint Version,
    int MaxObjectiveCountLimit,
    string SupportedAllowedWeights,
    bool QuantitativeAvailable,
    bool QualitativeAvailable,
    StartingObjectivePlanningConfigurationDto StartingConfiguration,
    DateTime? AppliedAt,
    Guid? AppliedByUserId,
    string? AppliedByName);

public sealed record StartingObjectivePlanningConfigurationDto(
    Guid Id,
    int VersionNumber,
    int MaxObjectiveCount,
    string AllowedWeights,
    bool QuantitativeEnabled,
    bool QualitativeEnabled,
    DateTime? AppliedAt);

public sealed record PlatformPerformanceConfigurationSummaryDto(
    bool IsConfigured,
    PlatformPerformanceConfigurationDto? Configuration);

public sealed record ApplyPlatformPerformanceConfigurationRequest(
    int MaxObjectiveCountLimit,
    string SupportedAllowedWeights,
    bool QuantitativeAvailable,
    bool QualitativeAvailable,
    int StartingMaxObjectiveCount,
    string StartingAllowedWeights,
    bool StartingQuantitativeEnabled,
    bool StartingQualitativeEnabled);

public sealed record PlatformConfigurationImpactDto(
    int AffectedTenantConfigurationCount,
    IReadOnlyList<string> BlockingReasons);

public sealed record PlatformConfigurationApplyResultDto(
    bool Applied,
    PlatformPerformanceConfigurationDto? Configuration,
    IReadOnlyList<string> Errors,
    PlatformConfigurationImpactDto? Impact);
