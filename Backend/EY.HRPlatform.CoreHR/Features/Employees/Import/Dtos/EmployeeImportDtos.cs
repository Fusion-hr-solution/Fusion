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
    string? HireDate,
    string? JobTitle,
    string? OrgUnitCode,
    string? ManagerEmail);

public sealed record EmployeeImportActorDto(
    Guid UserId,
    string FullName,
    string Role);

public sealed record EmployeeImportApplyResultDto(
    Guid SessionId,
    Guid HistoryId,
    string SourceFileName,
    int SourceRowCount,
    int ValidRowCount,
    int CreatedCount,
    int SkippedCount,
    DateTime AppliedAt,
    EmployeeImportStage Stage);

public sealed record EmployeeImportHistoryListItemDto(
    Guid Id,
    Guid SessionId,
    string SourceFileName,
    long SourceFileSizeBytes,
    int SourceRowCount,
    int ValidRowCount,
    int CreatedCount,
    int SkippedCount,
    string Status,
    DateTime AppliedAt,
    Guid ActorUserId,
    string ActorFullName,
    string ActorRole);

public sealed record EmployeeImportHistoryDetailDto(
    Guid Id,
    Guid SessionId,
    uint Version,
    string SourceFileName,
    long SourceFileSizeBytes,
    int SourceRowCount,
    int ValidRowCount,
    int CreatedCount,
    int SkippedCount,
    string Status,
    DateTime AppliedAt,
    Guid ActorUserId,
    string ActorFullName,
    string ActorRole,
    string? FailureReason)
{
    public IReadOnlyList<EmployeeImportFollowUpIssueDto> UnresolvedFollowUpIssues { get; init; } = Array.Empty<EmployeeImportFollowUpIssueDto>();
}

public sealed record EmployeeImportFollowUpIssueDto(
    Guid Id,
    int SourceRowNumber,
    Guid EmployeeId,
    string EmployeeFullName,
    string EmployeeEmail,
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
    DateTime? AppliedAt,
    DateTime ExpiresAt,
    EmployeeImportSchemaDto EmployeeImportSchema,
    bool CanValidate,
    bool CanApply);
