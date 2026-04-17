using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public class DraftStructureImportSession : BaseEntity, ITenantEntity
{
    private DraftStructureImportSession() { }

    public Guid TenantId { get; private set; }

    public uint Version { get; private set; }

    public DraftStructureImportStage Stage { get; private set; }

    public string SourceFileName { get; private set; } = string.Empty;

    public long SourceFileSizeBytes { get; private set; }

    public string SourceHeadersJson { get; private set; } = "[]";

    public string SourceRowsJson { get; private set; } = "[]";

    public string? MappingJson { get; private set; }

    public string? KindReconciliationsJson { get; private set; }

    public string? NormalizedRowsJson { get; private set; }

    public string? ValidationIssuesJson { get; private set; }

    public string SchemaFingerprint { get; private set; } = string.Empty;

    public string DraftWatermark { get; private set; } = string.Empty;

    public DateTime ExpiresAt { get; private set; }

    public DateTime? AppliedAt { get; private set; }

    public static DraftStructureImportSession CreateUploaded(
        Guid tenantId,
        string sourceFileName,
        long sourceFileSizeBytes,
        string sourceHeadersJson,
        string sourceRowsJson,
        string schemaFingerprint,
        string draftWatermark,
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

        if (string.IsNullOrWhiteSpace(schemaFingerprint))
            throw new ArgumentException("SchemaFingerprint cannot be empty.", nameof(schemaFingerprint));

        if (string.IsNullOrWhiteSpace(draftWatermark))
            throw new ArgumentException("DraftWatermark cannot be empty.", nameof(draftWatermark));

        return new DraftStructureImportSession
        {
            TenantId = tenantId,
            Stage = DraftStructureImportStage.Uploaded,
            SourceFileName = sourceFileName.Trim(),
            SourceFileSizeBytes = sourceFileSizeBytes,
            SourceHeadersJson = sourceHeadersJson,
            SourceRowsJson = sourceRowsJson,
            SchemaFingerprint = schemaFingerprint,
            DraftWatermark = draftWatermark,
            ExpiresAt = expiresAt
        };
    }

    public void SetMapping(string mappingJson, string? kindReconciliationsJson, bool allKindsResolved)
    {
        MappingJson = RequireJson(mappingJson, nameof(mappingJson));
        KindReconciliationsJson = string.IsNullOrWhiteSpace(kindReconciliationsJson) ? null : kindReconciliationsJson;
        Stage = allKindsResolved ? DraftStructureImportStage.KindReconciled : DraftStructureImportStage.Mapped;
        NormalizedRowsJson = null;
        ValidationIssuesJson = null;
        AppliedAt = null;
        Touch();
    }

    public void SetKindReconciliations(string kindReconciliationsJson, bool allKindsResolved)
    {
        KindReconciliationsJson = RequireJson(kindReconciliationsJson, nameof(kindReconciliationsJson));
        Stage = allKindsResolved ? DraftStructureImportStage.KindReconciled : DraftStructureImportStage.Mapped;
        NormalizedRowsJson = null;
        ValidationIssuesJson = null;
        AppliedAt = null;
        Touch();
    }

    public void SetValidationResult(
        string normalizedRowsJson,
        string validationIssuesJson,
        string schemaFingerprint,
        string draftWatermark)
    {
        NormalizedRowsJson = RequireJson(normalizedRowsJson, nameof(normalizedRowsJson));
        ValidationIssuesJson = RequireJson(validationIssuesJson, nameof(validationIssuesJson));
        SchemaFingerprint = RequireValue(schemaFingerprint, nameof(schemaFingerprint));
        DraftWatermark = RequireValue(draftWatermark, nameof(draftWatermark));
        Stage = DraftStructureImportStage.Validated;
        AppliedAt = null;
        Touch();
    }

    public void MarkApplied()
    {
        Stage = DraftStructureImportStage.Applied;
        AppliedAt = DateTime.UtcNow;
        Touch();
    }

    public void MarkExpired()
    {
        Stage = DraftStructureImportStage.Expired;
        Touch();
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;

    private static string RequireJson(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException($"{paramName} cannot be empty.", paramName);

        return value;
    }

    private static string RequireValue(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException($"{paramName} cannot be empty.", paramName);

        return value.Trim();
    }
}

public enum DraftStructureImportStage
{
    Uploaded,
    Mapped,
    KindReconciled,
    Validated,
    Applied,
    Expired
}