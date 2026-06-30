namespace EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;

public sealed record GuardrailsDto(
    Guid Id,
    uint Version,
    bool IsDraft,
    int MinObjectivesPerPlan,
    int MaxObjectivesPerPlan,
    int MinManagerValidationSlaDays,
    int MaxManagerValidationSlaDays,
    int PermittedWeightDecimalPlaces,
    int MaxAllowedWeightingValues,
    string SupportedMeasurementTypes,
    int MaxTemplateTitleLength,
    int MaxTemplateDescriptionLength,
    int MaxTemplateTags,
    bool ObjectiveLibraryEnabled);

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

public sealed record CreateGuardrailsDraftRequest(
    int MinObjectivesPerPlan,
    int MaxObjectivesPerPlan,
    int MinManagerValidationSlaDays,
    int MaxManagerValidationSlaDays,
    int PermittedWeightDecimalPlaces,
    int MaxAllowedWeightingValues,
    string SupportedMeasurementTypes,
    int MaxTemplateTitleLength,
    int MaxTemplateDescriptionLength,
    int MaxTemplateTags,
    bool ObjectiveLibraryEnabled);

public sealed record CreateBaselineDraftRequest(
    int MaxObjectivesPerPlan,
    string AllowedWeightValues,
    int ManagerValidationSlaDays,
    string CascadeMode,
    string MeasurementTypes,
    bool AttachmentsEnabled);
