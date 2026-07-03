namespace EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;

public sealed record GuardrailsDto(
    Guid Id,
    uint Version,
    int MinObjectivesPerPlan,
    int MaxObjectivesPerPlan,
    int MinManagerValidationSlaDays,
    int MaxManagerValidationSlaDays,
    int PermittedWeightDecimalPlaces,
    int MaxAllowedWeightingValues,
    string SupportedMeasurementTypes,
    int MaxTemplateTitleLength,
    int MaxTemplateDescriptionLength,
    int MaxTemplateTags);

public sealed record BaselineVersionDto(
    Guid Id,
    int VersionNumber,
    string Status,
    int MaxObjectivesPerPlan,
    string AllowedWeightValues,
    int ManagerValidationSlaDays,
    string CascadeMode,
    string MeasurementTypes,
    bool AttachmentsEnabled,
    DateTime? PublishedAt,
    DateTime? SupersededAt);

public sealed record ApplyGuardrailsRequest(
    int MinObjectivesPerPlan,
    int MaxObjectivesPerPlan,
    int MinManagerValidationSlaDays,
    int MaxManagerValidationSlaDays,
    int PermittedWeightDecimalPlaces,
    int MaxAllowedWeightingValues,
    string SupportedMeasurementTypes,
    int MaxTemplateTitleLength,
    int MaxTemplateDescriptionLength,
    int MaxTemplateTags);

public sealed record ApplyBaselineRequest(
    int MaxObjectivesPerPlan,
    string AllowedWeightValues,
    int ManagerValidationSlaDays,
    string CascadeMode,
    string MeasurementTypes,
    bool AttachmentsEnabled);

public sealed record PlatformDefaultsStatusDto(
    string Tone,
    string Label,
    string Message);

public sealed record PlatformDefaultsActivityDto(
    string Action,
    string? ActorName,
    DateTime OccurredAt);

public sealed record PlatformDefaultsSummaryDto(
    PlatformDefaultsStatusDto Status,
    GuardrailsDto? AppliedGuardrails,
    BaselineVersionDto? AppliedBaseline,
    PlatformDefaultsActivityDto? LastUpdated);

/// <summary>Result of an atomic guardrails apply: either applied, or blocked with the impact.</summary>
public sealed record GuardrailsApplyResultDto(
    bool Applied,
    GuardrailsDto? Guardrails,
    GuardrailImpactPreviewDto? Impact);

/// <summary>Result of an atomic baseline apply: either applied, or rejected with validation errors.</summary>
public sealed record BaselineApplyResultDto(
    bool Applied,
    BaselineVersionDto? Baseline,
    IReadOnlyList<string> Errors);

public sealed record GuardrailImpactReasonDto(
    string Reason,
    int AffectedCount);

public sealed record GuardrailImpactPreviewDto(
    bool HasConflicts,
    int AffectedTenantPolicyCount,
    IReadOnlyList<GuardrailImpactReasonDto> TenantPolicyConflicts,
    IReadOnlyList<string> StandardSetupConflicts);
