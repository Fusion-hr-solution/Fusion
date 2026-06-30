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
    PolicyVersionDto? ActiveVersion,
    PolicyVersionDto? DraftVersion);

public sealed record CreatePolicyDraftRequest(
    int MaxObjectivesPerPlan,
    string AllowedWeightValues,
    int ManagerValidationSlaDays,
    string CascadeMode,
    string MeasurementTypes,
    bool AttachmentsEnabled);

public sealed record UpdatePolicyDraftRequest(
    int MaxObjectivesPerPlan,
    string AllowedWeightValues,
    int ManagerValidationSlaDays,
    string CascadeMode,
    string MeasurementTypes,
    bool AttachmentsEnabled,
    uint ExpectedVersion);

public sealed record PublishPolicyRequest(
    uint ExpectedVersion,
    string? ChangeSummary = null);
