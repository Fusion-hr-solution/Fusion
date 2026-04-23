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
    bool HasMorePreviewRows,
    DateTime ExpiresAt,
    EmployeeImportSchemaDto EmployeeImportSchema);