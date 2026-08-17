using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Dtos;

public sealed record EmployeeImportCanonicalFieldDto(
    string Key,
    string DisplayLabel,
    bool Required,
    string Description,
    string Example);

public sealed record EmployeeImportSchemaDto(
    IReadOnlyList<EmployeeImportCanonicalFieldDto> CanonicalFields);

public sealed record EmployeeImportSourceRowDto(
    int RowNumber,
    IReadOnlyDictionary<string, string?> Values);

/// <summary>
/// How a validated import row maps onto canonical workforce facts. The label is the row's primary
/// (most operationally significant) classification; the full set of detected changes is carried by
/// the row's change flags and published atomically regardless of the headline label.
/// </summary>
public enum EmployeeImportRowClassification
{
    Create,
    Unchanged,
    ProfileCorrection,
    EmploymentChange,
    WorkAssignmentChange,
    ManagerChange,
    Invalid,
    Conflicting
}

public sealed record EmployeeImportValidationIssueDto(
    int RowNumber,
    string? Field,
    string Severity,
    string Code,
    string Message,
    string Category,
    string GroupKey,
    string? Value,
    string FixHint);

public sealed record EmployeeImportValidationSummaryDto(
    int TotalRows,
    int ValidRows,
    int ErrorCount,
    int WarningCount);

public sealed record EmployeeImportPreviewRowDto(
    int RowNumber,
    string? EmployeeNumber,
    string? FirstName,
    string? LastName,
    string? Email,
    string? Phone,
    string? HireDate,
    string? JobTitle,
    string? WorkLocation,
    string? EmploymentType,
    string? OrgUnitCode,
    string? ManagerEmail,
    string? EffectiveDate = null,
    EmployeeImportRowClassification? Classification = null,
    string? ResolvedEffectiveDate = null,
    Guid? MatchedEmployeeId = null,
    IReadOnlyList<string>? ChangedFacts = null);

public sealed record EmployeeImportActorDto(
    Guid UserId,
    string FullName,
    string Role);

public sealed record EmployeeImportApplyOperationDto(
    Guid Id,
    Guid SessionId,
    EmployeeImportApplyOperationStatus Status,
    Guid ActorUserId,
    string ActorFullName,
    string ActorRole,
    DateTime QueuedAt,
    DateTime? StartedAt,
    DateTime? CompletedAt,
    DateTime? FailedAt,
    string? FailureReason,
    Guid? HistoryId,
    int? SourceRowCount,
    int? ValidatedRowCount,
    int ProcessedRowCount,
    int? CreatedCount,
    int? PublishedRowCount);

public sealed record EmployeeImportApplyResultDto(
    Guid SessionId,
    Guid HistoryId,
    string SourceFileName,
    int SourceRowCount,
    int ValidatedRowCount,
    int CreatedCount,
    int PublishedRowCount,
    DateTime AppliedAt,
    EmployeeImportStage Stage);

public sealed record EmployeeImportHistoryListItemDto(
    Guid Id,
    Guid SessionId,
    string SourceFileName,
    long SourceFileSizeBytes,
    int SourceRowCount,
    int ValidatedRowCount,
    int CreatedCount,
    int UnchangedRowCount,
    int PublishedRowCount,
    string Status,
    DateTime AppliedAt,
    Guid ActorUserId,
    string ActorFullName,
    string ActorRole,
    string EventType,
    int ErrorCount,
    int WarningCount);

public sealed record EmployeeImportHistoryDetailDto(
    Guid Id,
    Guid SessionId,
    uint Version,
    string SourceFileName,
    long SourceFileSizeBytes,
    int SourceRowCount,
    int ValidatedRowCount,
    int CreatedCount,
    int UnchangedRowCount,
    int PublishedRowCount,
    string Status,
    DateTime AppliedAt,
    Guid ActorUserId,
    string ActorFullName,
    string ActorRole,
    string? FailureReason,
    string EventType,
    int ErrorCount,
    int WarningCount)
{
    public IReadOnlyList<EmployeeImportFollowUpIssueDto> UnresolvedFollowUpIssues { get; init; } = Array.Empty<EmployeeImportFollowUpIssueDto>();
}

public sealed record EmployeeImportFollowUpIssueDto(
    Guid Id,
    int SourceRowNumber,
    Guid EmployeeId,
    string EmployeeFullName,
    string? EmployeeEmail,
    string Code,
    string Label,
    string? FieldKey,
    EmployeeReadinessFixTargetDto FixTarget);

public sealed record EmployeeImportHistoryPageDto(
    IReadOnlyList<EmployeeImportHistoryListItemDto> Items,
    int PageNumber,
    int PageSize,
    int TotalCount,
    int PageCount);

public sealed record EmployeeImportSessionDto(
    Guid Id,
    EmployeeImportStage Stage,
    uint Version,
    DateTime BatchEffectiveDate,
    EmployeeImportMode ImportMode,
    string SourceFileName,
    long SourceFileSizeBytes,
    int SourceRowCount,
    IReadOnlyList<string> SourceHeaders,
    IReadOnlyList<EmployeeImportSourceRowDto> SampleRows,
    IReadOnlyList<EmployeeImportPreviewRowDto> PreviewRows,
    int PreviewPageNumber,
    int PreviewPageSize,
    int PreviewPageCount,
    int TotalPreviewRowCount,
    bool HasMorePreviewRows,
    EmployeeImportValidationSummaryDto ValidationSummary,
    IReadOnlyList<EmployeeImportValidationIssueDto> ValidationIssues,
    EmployeeImportApplyOperationDto? LastApplyOperation,
    DateTime? AppliedAt,
    DateTime ExpiresAt,
    EmployeeImportSchemaDto EmployeeImportSchema,
    bool CanValidate,
    bool CanApply);
