using System.Text.Json.Serialization;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportShape { Native, ParentReference, LevelColumns, Unresolved }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportResolutionStatus { Resolved, Suggested, Unresolved }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportResolutionOrigin { Native, Deterministic, Administrator, FutureSuggestion }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportNodeClassification { Unchanged, Create, Conflict }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportIssueSeverity { Blocker, Warning, Information }

public static class OrganizationImportFields
{
    public const string FusionOrgUnitId = "fusionOrgUnitId";
    public const string BusinessCode = "businessCode";
    public const string Name = "name";
    public const string Type = "type";
    public const string ParentBusinessCode = "parentBusinessCode";
}

public sealed record OrganizationImportFieldMapping(
    string Field,
    int? ColumnIndex,
    OrganizationImportResolutionStatus Status,
    OrganizationImportResolutionOrigin Origin);

public sealed record OrganizationImportRootDecision(string Name, string BusinessCode);
public sealed record OrganizationImportNodeCorrection(string? Name, string? BusinessCode, Guid? TypeId, string? ParentNodeId, Guid? ParentCanonicalId);

public sealed record OrganizationImportDecisions(
    OrganizationImportShape? Shape = null,
    IReadOnlyDictionary<string, int?>? FieldMappings = null,
    IReadOnlyDictionary<string, Guid>? TypeMappings = null,
    IReadOnlyDictionary<string, Guid>? AcceptedExistingMatches = null,
    IReadOnlyDictionary<string, OrganizationImportNodeCorrection>? NodeCorrections = null,
    IReadOnlyCollection<string>? ExcludedNodeIds = null,
    IReadOnlyCollection<string>? KeepCanonicalNodeIds = null,
    OrganizationImportRootDecision? IntroducedRoot = null)
{
    public OrganizationImportDecisions Normalize() => new(
        Shape,
        FieldMappings is null ? new Dictionary<string, int?>() : new Dictionary<string, int?>(FieldMappings, StringComparer.Ordinal),
        TypeMappings is null ? new Dictionary<string, Guid>() : new Dictionary<string, Guid>(TypeMappings, StringComparer.OrdinalIgnoreCase),
        AcceptedExistingMatches is null ? new Dictionary<string, Guid>() : new Dictionary<string, Guid>(AcceptedExistingMatches, StringComparer.Ordinal),
        NodeCorrections is null ? new Dictionary<string, OrganizationImportNodeCorrection>() : new Dictionary<string, OrganizationImportNodeCorrection>(NodeCorrections, StringComparer.Ordinal),
        ExcludedNodeIds is null ? [] : ExcludedNodeIds.Distinct(StringComparer.Ordinal).ToArray(),
        KeepCanonicalNodeIds is null ? [] : KeepCanonicalNodeIds.Distinct(StringComparer.Ordinal).ToArray(),
        IntroducedRoot);
}

public sealed record OrganizationImportTypeOption(Guid Id, string Name);
public sealed record OrganizationImportCandidate(Guid Id, string Code, string Name, Guid TypeId, string TypeName, Guid? ParentId);
public sealed record OrganizationImportSourceCell(int RowNumber, int ColumnIndex, string? Value);

/// <summary>
/// Presentation-only evidence for an authoritative-identity contradiction: the existing
/// canonical unit each supplied identifier resolves to. Derived from the deterministic
/// identity comparison; never used as identity authority or included in the semantic digest.
/// </summary>
public sealed record OrganizationImportIdentityEvidence(
    string Identifier,
    string SuppliedValue,
    Guid UnitId,
    string UnitName,
    string UnitCode);

public sealed record OrganizationImportReviewNode(
    string Id,
    string Name,
    string? BusinessCode,
    bool BusinessCodeGenerated,
    string? RawType,
    Guid? TypeId,
    string? TypeName,
    string? ParentNodeId,
    Guid? ParentCanonicalId,
    string? RawParent,
    Guid? CanonicalId,
    OrganizationImportNodeClassification Classification,
    bool IsProposalRoot,
    IReadOnlyList<OrganizationImportCandidate> DescriptiveCandidates,
    IReadOnlyList<OrganizationImportSourceCell> SourceCells,
    IReadOnlyList<OrganizationImportIdentityEvidence> IdentityEvidence);

public sealed record OrganizationImportResultNode(
    string Id,
    Guid? CanonicalId,
    string Name,
    string BusinessCode,
    string TypeName,
    string? ParentId,
    bool IsNew,
    bool IsRoot);

public sealed record OrganizationImportIssue(
    string Code,
    OrganizationImportIssueSeverity Severity,
    string Title,
    string Message,
    int AffectedCount,
    IReadOnlyList<string> NodeIds,
    IReadOnlyList<OrganizationImportSourceCell> SourceCells,
    IReadOnlyList<string> RecoveryActions);

public sealed record OrganizationImportReview(
    OrganizationImportShape Shape,
    OrganizationImportResolutionStatus ShapeStatus,
    OrganizationImportResolutionOrigin ShapeOrigin,
    IReadOnlyList<OrganizationImportFieldMapping> FieldMappings,
    IReadOnlyList<OrganizationImportTypeOption> TypeOptions,
    IReadOnlyList<OrganizationImportReviewNode> ProposalNodes,
    IReadOnlyList<OrganizationImportResultNode> ResultingOrganization,
    IReadOnlyList<OrganizationImportIssue> Issues,
    int ExistingCount,
    int CreateCount,
    bool CanCommit,
    string SemanticDigest,
    string CanonicalObservationDigest,
    int DecisionRevision,
    DateTime? DecisionsUpdatedAt,
    string? DecisionsUpdatedByDisplayName,
    IReadOnlyList<OrganizationImportIgnoredColumn> IgnoredColumns);

public sealed record ReplaceOrganizationImportDecisionsRequest(OrganizationImportDecisions Decisions);
public sealed record CommitOrganizationImportRequest(string SemanticDigest);
public sealed record OrganizationImportCreatedUnit(string ProposalNodeId, Guid OrgUnitId, string BusinessCode, string Name);
public sealed record OrganizationImportCommitResult(Guid SessionId, DateOnly EffectiveDate, IReadOnlyList<OrganizationImportCreatedUnit> CreatedUnits, bool NoChanges);
public sealed record OrganizationImportProvenance(string ProposalNodeId, Guid? OrgUnitId, IReadOnlyList<OrganizationImportSourceCell> SourceCells, string Resolution);

public sealed class OrganizationImportReviewException(string code, string safeMessage, int statusCode = StatusCodes.Status422UnprocessableEntity)
    : Exception(safeMessage)
{
    public string Code { get; } = code;
    public int StatusCode { get; } = statusCode;
}
