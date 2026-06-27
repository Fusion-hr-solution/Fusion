using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public class EmployeeImportSession : BaseEntity, ITenantEntity
{
    private EmployeeImportSession() { }

    public Guid TenantId { get; private set; }

    public uint Version { get; private set; }

    public EmployeeImportStage Stage { get; private set; }

    /// <summary>
    /// Required effective date applied to every business change in the batch unless a row overrides it.
    /// </summary>
    public DateTime BatchEffectiveDate { get; private set; }

    /// <summary>Batch-level mode; a single batch never mixes corrections and business changes.</summary>
    public EmployeeImportMode ImportMode { get; private set; }

    public string SourceFileName { get; private set; } = string.Empty;

    public long SourceFileSizeBytes { get; private set; }

    public string SourceHeadersJson { get; private set; } = "[]";

    public string SourceRowsJson { get; private set; } = "[]";

    public string PreviewRowsJson { get; private set; } = "[]";

    public string? NormalizedRowsJson { get; private set; }

    public string? ValidationIssuesJson { get; private set; }

    public DateTime? AppliedAt { get; private set; }

    public DateTime ExpiresAt { get; private set; }

    public static EmployeeImportSession CreatePreviewReady(
        Guid tenantId,
        string sourceFileName,
        long sourceFileSizeBytes,
        string sourceHeadersJson,
        string sourceRowsJson,
        string previewRowsJson,
        DateTime expiresAt,
        DateTime? batchEffectiveDate = null,
        EmployeeImportMode importMode = EmployeeImportMode.BusinessChange)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        if (string.IsNullOrWhiteSpace(sourceFileName))
            throw new ArgumentException("SourceFileName cannot be empty.", nameof(sourceFileName));

        if (string.IsNullOrWhiteSpace(sourceHeadersJson))
            throw new ArgumentException("SourceHeadersJson cannot be empty.", nameof(sourceHeadersJson));

        if (string.IsNullOrWhiteSpace(sourceRowsJson))
            throw new ArgumentException("SourceRowsJson cannot be empty.", nameof(sourceRowsJson));

        if (string.IsNullOrWhiteSpace(previewRowsJson))
            throw new ArgumentException("PreviewRowsJson cannot be empty.", nameof(previewRowsJson));

        return new EmployeeImportSession
        {
            TenantId = tenantId,
            Stage = EmployeeImportStage.PreviewReady,
            SourceFileName = sourceFileName.Trim(),
            SourceFileSizeBytes = sourceFileSizeBytes,
            SourceHeadersJson = sourceHeadersJson,
            SourceRowsJson = sourceRowsJson,
            PreviewRowsJson = previewRowsJson,
            ExpiresAt = expiresAt,
            BatchEffectiveDate = NormalizeEffectiveDate(batchEffectiveDate ?? DateTime.UtcNow),
            ImportMode = importMode
        };
    }

    private static DateTime NormalizeEffectiveDate(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value.Date,
        DateTimeKind.Local => value.ToUniversalTime().Date,
        _ => DateTime.SpecifyKind(value.Date, DateTimeKind.Utc)
    };

    public void SetValidationResult(string normalizedRowsJson, string validationIssuesJson)
    {
        NormalizedRowsJson = RequireJson(normalizedRowsJson, nameof(normalizedRowsJson));
        ValidationIssuesJson = RequireJson(validationIssuesJson, nameof(validationIssuesJson));
        AppliedAt = null;
        Stage = EmployeeImportStage.Validated;
        Touch();
    }

    public void MarkExpired()
    {
        Stage = EmployeeImportStage.Expired;
        Touch();
    }

    public void MarkApplied(DateTime appliedAtUtc)
    {
        if (appliedAtUtc == default)
            throw new ArgumentException("AppliedAt must be a valid date.", nameof(appliedAtUtc));

        AppliedAt = appliedAtUtc.Kind switch
        {
            DateTimeKind.Utc => appliedAtUtc,
            DateTimeKind.Local => appliedAtUtc.ToUniversalTime(),
            _ => throw new ArgumentException(
                "AppliedAt must have DateTimeKind.Utc or DateTimeKind.Local; Unspecified is not allowed.",
                nameof(appliedAtUtc))
        };

        Stage = EmployeeImportStage.Applied;
        Touch();
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;

    private static string RequireJson(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException($"{paramName} cannot be empty.", paramName);

        return value;
    }
}

public enum EmployeeImportStage
{
    PreviewReady,
    Validated,
    Applied,
    Expired
}

public enum EmployeeImportMode
{
    /// <summary>Default: create or close effective-dated records without overwriting history.</summary>
    BusinessChange,

    /// <summary>Apply minimal, explicit, audited corrections to existing facts.</summary>
    Correction
}