using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public class EmployeeImportSession : BaseEntity, ITenantEntity
{
    private EmployeeImportSession() { }

    public Guid TenantId { get; private set; }

    public uint Version { get; private set; }

    public EmployeeImportStage Stage { get; private set; }

    public string SourceFileName { get; private set; } = string.Empty;

    public long SourceFileSizeBytes { get; private set; }

    public string SourceHeadersJson { get; private set; } = "[]";

    public string SourceRowsJson { get; private set; } = "[]";

    public string PreviewRowsJson { get; private set; } = "[]";

    public DateTime ExpiresAt { get; private set; }

    public static EmployeeImportSession CreatePreviewReady(
        Guid tenantId,
        string sourceFileName,
        long sourceFileSizeBytes,
        string sourceHeadersJson,
        string sourceRowsJson,
        string previewRowsJson,
        DateTime expiresAt)
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
            ExpiresAt = expiresAt
        };
    }

    public void MarkExpired()
    {
        Stage = EmployeeImportStage.Expired;
        UpdatedAt = DateTime.UtcNow;
    }
}

public enum EmployeeImportStage
{
    PreviewReady,
    Expired
}