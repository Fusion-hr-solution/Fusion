namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;

// ── Revision DTOs ─────────────────────────────────────────────────────

public sealed record TemplateRevisionDto(
    Guid Id,
    Guid TemplateId,
    int VersionNumber,
    string Status,
    string Title,
    string? Description,
    Guid? CategoryId,
    string MeasurementType,
    decimal? SuggestedWeighting,
    string? Tags,
    decimal? TargetValue,
    string? Unit,
    string? SuccessCriteria,
    uint Version,
    Guid? SourceRevisionId,
    string CreatedByUserId,
    string? CreatedByName,
    DateTime? ActivatedAt,
    string? ActivatedByUserId,
    string? ActivatedByName,
    string? ChangeSummary,
    DateTime? SupersededAt,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    IReadOnlyList<Guid> ApplicableOrgUnitIds,
    IReadOnlyList<string> ApplicableJobTitles,
    IReadOnlyList<string> ApplicableWorkLocations,
    IReadOnlyList<string> ApplicableEmploymentTypes,
    string ApplicabilityValidationState);

/// <summary>Concise entry for the simple revision history required by P1.1 §15.2.</summary>
public sealed record TemplateRevisionHistoryEntryDto(
    Guid Id,
    int VersionNumber,
    string Status,
    string Title,
    DateTime? ActivatedAt,
    string? ActivatedByName,
    DateTime? SupersededAt,
    string? ChangeSummary);

// ── Template container DTO ────────────────────────────────────────────

public sealed record TemplateDto(
    Guid Id,
    Guid TenantId,
    string Status,
    TemplateRevisionDto? ActiveRevision,
    TemplateRevisionDto? DraftRevision,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

// ── Requests ──────────────────────────────────────────────────────────

public sealed record CreateTemplateDraftRequest(
    string Title,
    string? Description,
    Guid? CategoryId,
    string MeasurementType,
    decimal? SuggestedWeighting,
    string? Tags,
    decimal? TargetValue,
    string? Unit,
    string? SuccessCriteria,
    Guid? SourceRevisionId = null,
    IReadOnlyList<Guid>? ApplicableOrgUnitIds = null,
    IReadOnlyList<string>? ApplicableJobTitles = null,
    IReadOnlyList<string>? ApplicableWorkLocations = null,
    IReadOnlyList<string>? ApplicableEmploymentTypes = null);

public sealed record UpdateTemplateDraftRequest(
    string Title,
    string? Description,
    Guid? CategoryId,
    string MeasurementType,
    decimal? SuggestedWeighting,
    string? Tags,
    decimal? TargetValue,
    string? Unit,
    string? SuccessCriteria,
    uint ExpectedVersion,
    IReadOnlyList<Guid>? ApplicableOrgUnitIds = null,
    IReadOnlyList<string>? ApplicableJobTitles = null,
    IReadOnlyList<string>? ApplicableWorkLocations = null,
    IReadOnlyList<string>? ApplicableEmploymentTypes = null);

public sealed record ActivateTemplateRevisionRequest(
    string? ChangeSummary,
    uint ExpectedVersion);
