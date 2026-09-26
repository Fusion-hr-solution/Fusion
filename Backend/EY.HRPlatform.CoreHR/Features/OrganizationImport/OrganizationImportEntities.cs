using EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public enum OrganizationImportStatus
{
    Active,
    Discarded,
    Committed,
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
    public string DecisionsJson { get; private set; } = "{}";
    public int DecisionRevision { get; private set; }
    public DateTime? DecisionsUpdatedAt { get; private set; }
    public Guid? DecisionsUpdatedByUserId { get; private set; }
    public string? DecisionsUpdatedByDisplayName { get; private set; }
    public DateTime? CommittedAt { get; private set; }
    public Guid? CommittedByUserId { get; private set; }
    public string? CommittedByDisplayName { get; private set; }
    public string? FinalSemanticDigest { get; private set; }
    public string? CommitResultJson { get; private set; }
    public string? FinalProvenanceJson { get; private set; }
    public string? MappingConfirmationJson { get; private set; }
    public string? AppliedMappingPlanJson { get; private set; }
    public OrganizationImportSource Source { get; private set; } = null!;

    public static OrganizationImportSession Create(
        Guid tenantId,
        DateOnly effectiveDate,
        Guid creationToken,
        string creationFingerprint,
        ImportActor actor)
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

    public void ChangeEffectiveDate(DateOnly date, ImportActor actor)
    {
        EnsureActive();
        if (date != EffectiveDate)
        {
            var decisions = OrganizationImportJson.Deserialize<OrganizationImportDecisions>(DecisionsJson);
            if (decisions is not null) DecisionsJson = OrganizationImportJson.Serialize(decisions.WithoutExistingUnitChoices());
        }
        EffectiveDate = date;
        LastUpdatedByUserId = actor.UserId;
        LastUpdatedByDisplayName = actor.DisplayName;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReplaceDecisions(OrganizationImportDecisions decisions, ImportActor actor)
    {
        EnsureActive();
        var normalized = decisions.Normalize();
        var previous = OrganizationImportJson.Deserialize<OrganizationImportDecisions>(DecisionsJson)?.Normalize();
        if (previous is null || !SameMappingPlan(previous, normalized))
        {
            MappingConfirmationJson = null;
            AppliedMappingPlanJson = null;
            // Review resolutions were made against the previous canonical proposal.
            if (previous is not null) normalized = normalized.WithoutReviewResolutions();
        }
        DecisionsJson = OrganizationImportJson.Serialize(normalized);
        DecisionRevision++;
        DecisionsUpdatedAt = DateTime.UtcNow;
        DecisionsUpdatedByUserId = actor.UserId;
        DecisionsUpdatedByDisplayName = actor.DisplayName;
        LastUpdatedByUserId = actor.UserId;
        LastUpdatedByDisplayName = actor.DisplayName;
        UpdatedAt = DecisionsUpdatedAt;
    }

    public void ConfirmMapping(string digest, ImportActor actor)
    {
        EnsureActive();
        MappingConfirmationJson = OrganizationImportJson.Serialize(new OrganizationImportMappingConfirmation(
            digest, actor.Normalize().UserId, actor.Normalize().DisplayName, DateTime.UtcNow));
        LastUpdatedByUserId = actor.UserId;
        LastUpdatedByDisplayName = actor.DisplayName;
        UpdatedAt = DateTime.UtcNow;
    }

    public bool HasConfirmedMapping(string digest)
        => OrganizationImportJson.Deserialize<OrganizationImportMappingConfirmation>(MappingConfirmationJson)?.Digest == digest;

    public void ApplyMappingPlan(OrganizationImportMappingPlan plan)
    {
        EnsureActive();
        if (plan.SourceFingerprint != SourceFingerprint())
            throw new InvalidOperationException("A mapping plan cannot be applied to a different source.");
        AppliedMappingPlanJson = OrganizationImportJson.Serialize(plan);
    }

    private static bool SameMappingPlan(OrganizationImportDecisions left, OrganizationImportDecisions right)
        => left.Shape == right.Shape
            && left.IdentityStrategy == right.IdentityStrategy
            && left.FieldMappings!.OrderBy(item => item.Key, StringComparer.Ordinal)
                .SequenceEqual(right.FieldMappings!.OrderBy(item => item.Key, StringComparer.Ordinal))
            && left.TypeMappings!.OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
                .SequenceEqual(right.TypeMappings!.OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase))
            && left.ShapeDecisionOrigin == right.ShapeDecisionOrigin
            && left.FieldMappingOrigins!.OrderBy(item => item.Key, StringComparer.Ordinal)
                .SequenceEqual(right.FieldMappingOrigins!.OrderBy(item => item.Key, StringComparer.Ordinal))
            && left.TypeMappingOrigins!.OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
                .SequenceEqual(right.TypeMappingOrigins!.OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase));

    private string SourceFingerprint()
        => Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(
            $"{Source.Sha256}\n{Source.SelectedSheetName}\n{Source.SelectedRange}")));

    public void Commit(
        string semanticDigest,
        OrganizationImportCommitResult result,
        IReadOnlyList<OrganizationImportProvenance> provenance,
        ImportActor actor)
    {
        EnsureActive();
        Status = OrganizationImportStatus.Committed;
        CommittedAt = DateTime.UtcNow;
        CommittedByUserId = actor.UserId;
        CommittedByDisplayName = actor.DisplayName;
        FinalSemanticDigest = semanticDigest;
        CommitResultJson = OrganizationImportJson.Serialize(result);
        FinalProvenanceJson = OrganizationImportJson.Serialize(provenance);
        LastUpdatedByUserId = actor.UserId;
        LastUpdatedByDisplayName = actor.DisplayName;
        UpdatedAt = CommittedAt;
        Source.PurgePayload();
    }

    public bool Discard(ImportActor actor)
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
            throw new InvalidOperationException("A terminal import cannot be changed.");
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

/// <summary>An Organization Import semantic run; the shared attempt record under the organization contract versions.</summary>
public sealed class OrganizationImportSemanticAttempt : ImportSemanticAttempt
{
    private OrganizationImportSemanticAttempt() { }

    public static OrganizationImportSemanticAttempt Start(
        Guid tenantId,
        Guid sessionId,
        int attemptOrdinal,
        ImportSemanticTrigger trigger,
        OrganizationImportSemanticRequest request,
        string provider,
        string model)
    {
        var attempt = new OrganizationImportSemanticAttempt();
        attempt.Initialize(
            tenantId, sessionId, attemptOrdinal, trigger,
            request.SourceFingerprint, request.InputFingerprint,
            OrganizationImportSemanticVersions.DataContract, request.ResultContractVersion, OrganizationImportSemanticVersions.Prompt,
            provider, model, request.Issues.Select(issue => issue.Key).ToList());
        return attempt;
    }
}

public sealed record OrganizationImportMappingConfirmation(string Digest, Guid ConfirmedByUserId, string ConfirmedByDisplayName, DateTime ConfirmedAt);
