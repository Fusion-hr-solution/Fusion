namespace EY.HRPlatform.Performance.Features.ObjectivePolicy.Dtos;

public sealed record PolicyVersionDto(
    Guid Id,
    Guid PolicyId,
    int VersionNumber,
    string Status,
    int MaxObjectivesPerPlan,
    string AllowedWeightValues,
    int ManagerValidationSlaDays,
    string CascadeMode,
    string MeasurementTypes,
    bool AttachmentsEnabled,
    uint Version,
    Guid? SourceVersionId,
    Guid? SourceBaselineVersionId,
    Guid CreatedByUserId,
    string? CreatedByName,
    DateTime? ActivatedAt,
    Guid? ActivatedByUserId,
    string? ActivatedByName,
    string? ChangeSummary,
    DateTime? SupersededAt);

public sealed record PolicySummaryDto(
    Guid PolicyId,
    PolicyVersionDto? CurrentPolicy);

public sealed record ApplyPolicyRequest(
    int MaxObjectivesPerPlan,
    string AllowedWeightValues,
    int ManagerValidationSlaDays,
    string CascadeMode,
    string MeasurementTypes,
    bool AttachmentsEnabled,
    string? ChangeSummary = null);
