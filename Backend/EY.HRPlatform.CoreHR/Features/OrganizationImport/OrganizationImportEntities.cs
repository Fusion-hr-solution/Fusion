using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public enum OrganizationImportStatus
{
    Active,
    Discarded,
}

public sealed class OrganizationImportSession : BaseEntity, ITenantEntity
{
    private OrganizationImportSession() { }

    public Guid TenantId { get; private set; }
    public uint Version { get; private set; }
    public OrganizationImportStatus Status { get; private set; }
    public DateOnly EffectiveDate { get; private set; }
    public Guid CreationToken { get; private set; }
    public string CreationFingerprint { get; private set; } = string.Empty;
    public Guid StartedByUserId { get; private set; }
    public string StartedByDisplayName { get; private set; } = string.Empty;
    public Guid LastUpdatedByUserId { get; private set; }
    public string LastUpdatedByDisplayName { get; private set; } = string.Empty;
    public DateTime? DiscardedAt { get; private set; }
    public Guid? DiscardedByUserId { get; private set; }
    public OrganizationImportSource Source { get; private set; } = null!;

    public static OrganizationImportSession Create(
        Guid tenantId,
        DateOnly effectiveDate,
        Guid creationToken,
        string creationFingerprint,
        OrganizationImportActor actor)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant is required.", nameof(tenantId));
        if (creationToken == Guid.Empty) throw new ArgumentException("Creation token is required.", nameof(creationToken));
        if (string.IsNullOrWhiteSpace(creationFingerprint)) throw new ArgumentException("Creation fingerprint is required.", nameof(creationFingerprint));

        return new OrganizationImportSession
        {
            TenantId = tenantId,
            EffectiveDate = effectiveDate,
            CreationToken = creationToken,
            CreationFingerprint = creationFingerprint,
            Status = OrganizationImportStatus.Active,
            StartedByUserId = actor.UserId,
            StartedByDisplayName = actor.DisplayName,
            LastUpdatedByUserId = actor.UserId,
            LastUpdatedByDisplayName = actor.DisplayName,
        };
    }

    public void AttachSource(OrganizationImportSource source) => Source = source;

    public void ChangeEffectiveDate(DateOnly date, OrganizationImportActor actor)
    {
        EnsureActive();
        EffectiveDate = date;
        LastUpdatedByUserId = actor.UserId;
        LastUpdatedByDisplayName = actor.DisplayName;
        UpdatedAt = DateTime.UtcNow;
    }

    public bool Discard(OrganizationImportActor actor)
    {
        if (Status == OrganizationImportStatus.Discarded) return false;
        Status = OrganizationImportStatus.Discarded;
        DiscardedAt = DateTime.UtcNow;
        DiscardedByUserId = actor.UserId;
        LastUpdatedByUserId = actor.UserId;
        LastUpdatedByDisplayName = actor.DisplayName;
        UpdatedAt = DiscardedAt;
        Source.PurgePayload();
        return true;
    }

    private void EnsureActive()
    {
        if (Status != OrganizationImportStatus.Active)
            throw new InvalidOperationException("A discarded import cannot be changed.");
    }
}

public sealed class OrganizationImportSource : BaseEntity, ITenantEntity
{
    private OrganizationImportSource() { }

    public Guid SessionId { get; private set; }
    public Guid TenantId { get; private set; }
    public string OriginalFileName { get; private set; } = string.Empty;
    public string SourceFormat { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = string.Empty;
    public long ByteLength { get; private set; }
    public string Sha256 { get; private set; } = string.Empty;
    public string SelectedSheetName { get; private set; } = string.Empty;
    public string SelectedRange { get; private set; } = string.Empty;
    public int ColumnCount { get; private set; }
    public int RowCount { get; private set; }
    public string? SourceTableJson { get; private set; }
    public byte[]? RawBytes { get; private set; }
    public DateTime? PayloadPurgedAt { get; private set; }
    public OrganizationImportSession Session { get; private set; } = null!;

    public static OrganizationImportSource Create(
        Guid tenantId,
        Guid sessionId,
        InspectedOrganizationSource source)
        => new()
        {
            TenantId = tenantId,
            SessionId = sessionId,
            OriginalFileName = source.OriginalFileName,
            SourceFormat = source.SourceFormat,
            ContentType = source.ContentType,
            ByteLength = source.RawBytes.LongLength,
            Sha256 = source.Sha256,
            SelectedSheetName = source.SelectedSheetName,
            SelectedRange = source.SelectedRange,
            ColumnCount = source.Table.Columns.Count,
            RowCount = source.Table.Rows.Count,
            SourceTableJson = OrganizationImportJson.Serialize(source.Table),
            RawBytes = source.RawBytes,
        };

    public void PurgePayload()
    {
        if (PayloadPurgedAt is not null) return;
        RawBytes = null;
        SourceTableJson = null;
        PayloadPurgedAt = DateTime.UtcNow;
        UpdatedAt = PayloadPurgedAt;
    }
}

public sealed record OrganizationImportActor(Guid UserId, string DisplayName)
{
    public OrganizationImportActor Normalize()
        => new(UserId, string.IsNullOrWhiteSpace(DisplayName) ? "Unknown" : DisplayName.Trim()[..Math.Min(DisplayName.Trim().Length, 256)]);
}
