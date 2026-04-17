using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Import.Dtos;

public sealed record DraftStructureImportSchemaDto(
    DraftStructureSchemaDto DraftStructureSchema,
    List<DraftStructureImportCanonicalFieldDto> CanonicalFields);

public sealed record DraftStructureImportCanonicalFieldDto(
    string Key,
    string DisplayLabel,
    bool Required,
    string ValueType,
    List<string>? AllowedValues = null,
    List<string>? AppliesToKindKeys = null);

public sealed record DraftStructureImportSourceRowDto(
    int RowNumber,
    Dictionary<string, string?> Values);

public sealed record DraftStructureImportKindResolutionDto(
    string SourceValue,
    string? ResolvedOrgUnitKindKey,
    string? ResolvedDisplayLabel,
    bool CreateNewKind,
    bool IsResolved,
    string SuggestedOrgUnitKindKey);

public sealed record DraftStructureImportValidationIssueDto(
    int RowNumber,
    string? Field,
    string Severity,
    string Code,
    string Message);

public sealed record DraftStructureImportValidationSummaryDto(
    int TotalRows,
    int ValidRows,
    int ErrorCount,
    int WarningCount);

public sealed record DraftStructureImportPreviewRowDto(
    int RowNumber,
    string ReferenceKey,
    string DisplayName,
    string OrgUnitKindKey,
    string OrgUnitKindLabel,
    string? ParentReferenceKey,
    string? BusinessCode,
    string? Description,
    Dictionary<string, object?> Attributes);

public sealed record DraftStructureImportSessionDto(
    Guid Id,
    DraftStructureImportStage Stage,
    uint Version,
    string SourceFileName,
    long SourceFileSizeBytes,
    int SourceRowCount,
    List<string> SourceHeaders,
    List<DraftStructureImportSourceRowDto> SampleRows,
    DraftStructureImportSchemaDto ImportSchema,
    Dictionary<string, string> ColumnMappings,
    List<DraftStructureImportKindResolutionDto> KindResolutions,
    DraftStructureImportValidationSummaryDto ValidationSummary,
    List<DraftStructureImportValidationIssueDto> ValidationIssues,
    List<DraftStructureImportPreviewRowDto> PreviewRows,
    DateTime ExpiresAt,
    bool CanValidate,
    bool CanApply);

public sealed record DraftStructureImportMappingRequest(
    Dictionary<string, string> ColumnMappings);

public sealed record DraftStructureImportResolveKindsRequest(
    List<DraftStructureImportResolveKindInputDto> KindResolutions);

public sealed record DraftStructureImportResolveKindInputDto(
    string SourceValue,
    string? OrgUnitKindKey,
    string? DisplayLabel,
    bool CreateNewKind);

public sealed record DraftStructureImportApplyResultDto(
    Guid SessionId,
    int ReplacedUnitCount,
    DraftStructureSchemaDto DraftStructureSchema,
    DateTime AppliedAt);