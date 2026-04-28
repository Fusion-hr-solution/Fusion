using EY.HRPlatform.CoreHR.Domain.Entities;

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
    string? FirstName,
    string? LastName,
    string? Email,
    string? HireDate,
    string? JobTitle,
    string? OrgUnitCode,
    string? ManagerEmail);

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
    DateTime ExpiresAt,
    EmployeeImportSchemaDto EmployeeImportSchema,
    bool CanValidate);
