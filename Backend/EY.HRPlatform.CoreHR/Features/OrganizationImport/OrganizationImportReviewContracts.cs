using System.Text.Json.Serialization;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportShape { Native, ParentReference, LevelColumns, Unresolved }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportResolutionStatus { Resolved, Suggested, Unresolved }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportResolutionOrigin { Native, Deterministic, Administrator, SemanticSuggestion }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportNodeClassification { Create, Existing, Conflict }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportIssueSeverity { Blocker, Warning }
/// <summary>Where the fix for a Review issue belongs. Review never edits a proposed unit directly.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportResolutionKind { ReturnToMatch, CorrectSource, AddOrganizationRoot, KeepExisting, ChooseExistingUnit, ChangeEffectiveDate }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportReviewState { Ready, ReadyWithWarnings, Blocked }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportGeneratedIdentityStrategy { SourceBusinessCode, DeterministicFromNameAndPath }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportMappingStatus { Matched, Suggested, NeedsReview, Ignored }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportMatchReadinessState { Incomplete, Complete }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportMatchCompletionKind { Incomplete, Automatic, Confirmed }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportStage { Match, Review }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportRequiredDecisionKind { SourceShape, FieldMapping, TypeMapping, IdentityStrategy, MappingConflict }

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
    OrganizationImportResolutionOrigin Origin,
    string? Evidence = null,
    OrganizationImportMappingStatus MatchStatus = OrganizationImportMappingStatus.Matched);

public sealed record OrganizationImportTypeMapping(
    string SourceValue,
    Guid? TypeId,
    string? TypeName,
    int OccurrenceCount,
    OrganizationImportMappingStatus Status,
    OrganizationImportResolutionOrigin Origin,
    string? Evidence = null);

public sealed record OrganizationImportIdentityMapping(
    OrganizationImportGeneratedIdentityStrategy Strategy,
    int? SourceColumnIndex,
    OrganizationImportMappingStatus Status,
    OrganizationImportResolutionOrigin Origin,
    string Evidence);

public sealed record OrganizationImportRequiredDecision(
    string Key,
    OrganizationImportRequiredDecisionKind Kind,
    string? SourceValue = null,
    string? TargetField = null);

public sealed record OrganizationImportMatchReadiness(
    OrganizationImportMatchReadinessState State,
    bool CanContinue,
    IReadOnlyList<OrganizationImportRequiredDecision> RequiredDecisions,
    OrganizationImportStage RecommendedStage);

/// <summary>
/// The authoritative, source-bound interpretation of an uploaded table. Semantic output may
/// propose changes to this artifact, but normalization consumes only the persisted/user-visible
/// plan and never consumes provider output directly.
/// </summary>
public sealed record OrganizationImportMappingPlan(
    OrganizationImportShape SourceShape,
    OrganizationImportResolutionStatus ShapeStatus,
    OrganizationImportResolutionOrigin ShapeOrigin,
    IReadOnlyList<OrganizationImportFieldMapping> ColumnMappings,
    IReadOnlyDictionary<string, Guid> TypeMappings,
    IReadOnlyList<int> OrderedLevelColumns,
    IReadOnlyList<OrganizationImportIgnoredColumn> IgnoredColumns,
    OrganizationImportGeneratedIdentityStrategy GeneratedIdentityStrategy,
    string SourceFingerprint,
    IReadOnlyDictionary<string, OrganizationImportResolutionOrigin>? TypeMappingOrigins = null,
    IReadOnlyList<OrganizationImportTypeMapping>? TypeMappingDetails = null,
    OrganizationImportIdentityMapping? Identity = null,
    int Revision = 0,
    string? Digest = null);

/// <summary>
/// One unit of the canonical proposal. Parent-reference and level-column sources are
/// indistinguishable here: a unit sits under a proposed unit, under an existing unit, or at the top.
/// </summary>
public sealed record CanonicalOrganizationDraftNode(
    string Id,
    string BusinessCode,
    bool BusinessCodeGenerated,
    string Name,
    Guid? TypeId,
    string? TypeName,
    string? ParentNodeId,
    Guid? ParentExistingUnitId,
    Guid? ExistingOrgUnitId,
    OrganizationImportNodeClassification Classification,
    bool IsRoot,
    bool HasUnresolvedParent,
    IReadOnlyList<OrganizationImportSourceCell> SourceReference);

/// <summary>The tenant's permanent root, when one exists, and whether it is active on the effective date.</summary>
public sealed record CanonicalOrganizationRoot(Guid Id, bool ActiveAsOfEffectiveDate);

/// <summary>
/// The organization Fusion intends to establish: the only thing Review validates and the only thing
/// publication writes. Its fingerprint is the reviewed-proposal identity checked again at publish.
/// </summary>
public sealed record CanonicalOrganizationDraft(
    DateOnly EffectiveDate,
    IReadOnlyList<CanonicalOrganizationDraftNode> Nodes,
    CanonicalOrganizationRoot? PermanentRoot,
    string Fingerprint);

public sealed record OrganizationImportValidationResult(
    IReadOnlyList<OrganizationImportIssue> Issues,
    bool HasBlockingIssues,
    string DraftFingerprint);

public sealed record OrganizationImportRootDecision(string Name, string BusinessCode);

/// <summary>
/// Persisted import decisions. Match owns the source interpretation (shape, fields, types,
/// identity). Review may add only the bounded resolutions (an organization root and existing-unit
/// choices); it never renames, recodes, retypes, re-parents or drops a proposed unit.
/// </summary>
public sealed record OrganizationImportDecisions(
    OrganizationImportShape? Shape = null,
    IReadOnlyDictionary<string, int?>? FieldMappings = null,
    IReadOnlyDictionary<string, Guid>? TypeMappings = null,
    IReadOnlyDictionary<string, Guid>? AcceptedExistingMatches = null,
    IReadOnlyCollection<string>? KeepExistingNodeIds = null,
    OrganizationImportRootDecision? IntroducedRoot = null,
    OrganizationImportResolutionOrigin? ShapeDecisionOrigin = null,
    IReadOnlyDictionary<string, OrganizationImportResolutionOrigin>? FieldMappingOrigins = null,
    IReadOnlyDictionary<string, OrganizationImportResolutionOrigin>? TypeMappingOrigins = null,
    OrganizationImportGeneratedIdentityStrategy? IdentityStrategy = null)
{
    public OrganizationImportDecisions Normalize() => new(
        Shape,
        FieldMappings is null ? new Dictionary<string, int?>() : new Dictionary<string, int?>(FieldMappings, StringComparer.Ordinal),
        TypeMappings is null ? new Dictionary<string, Guid>() : new Dictionary<string, Guid>(TypeMappings, StringComparer.OrdinalIgnoreCase),
        AcceptedExistingMatches is null ? new Dictionary<string, Guid>() : new Dictionary<string, Guid>(AcceptedExistingMatches, StringComparer.Ordinal),
        KeepExistingNodeIds is null ? [] : KeepExistingNodeIds.Distinct(StringComparer.Ordinal).ToArray(),
        IntroducedRoot,
        ShapeDecisionOrigin,
        FieldMappingOrigins is null ? new Dictionary<string, OrganizationImportResolutionOrigin>() : new Dictionary<string, OrganizationImportResolutionOrigin>(FieldMappingOrigins, StringComparer.Ordinal),
        TypeMappingOrigins is null ? new Dictionary<string, OrganizationImportResolutionOrigin>() : new Dictionary<string, OrganizationImportResolutionOrigin>(TypeMappingOrigins, StringComparer.OrdinalIgnoreCase),
        IdentityStrategy);

    /// <summary>Review resolutions were made against one canonical proposal; a new interpretation starts without them.</summary>
    public OrganizationImportDecisions WithoutReviewResolutions() => Normalize() with
    {
        AcceptedExistingMatches = new Dictionary<string, Guid>(),
        KeepExistingNodeIds = [],
        IntroducedRoot = null,
    };

    /// <summary>Existing-unit choices depend on what exists on the effective date.</summary>
    public OrganizationImportDecisions WithoutExistingUnitChoices() => Normalize() with
    {
        AcceptedExistingMatches = new Dictionary<string, Guid>(),
        KeepExistingNodeIds = [],
    };
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

/// <summary>A unit as the interpreter reads it from source + Mapping Plan + the canonical snapshot.</summary>
public sealed record OrganizationImportProposalNode(
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
    bool HasUnresolvedParent,
    IReadOnlyList<OrganizationImportCandidate> DescriptiveCandidates,
    IReadOnlyList<OrganizationImportSourceCell> SourceCells,
    IReadOnlyList<OrganizationImportIdentityEvidence> IdentityEvidence);

/// <summary>
/// A structured Review finding. The server decides severity and where the fix belongs from the
/// issue's actual context; clients render these and never invent repair behaviour.
/// </summary>
public sealed record OrganizationImportIssue(
    string Code,
    OrganizationImportIssueSeverity Severity,
    string Title,
    string Message,
    string? ProposalNodeId,
    IReadOnlyList<string> RelatedNodeIds,
    string? Field,
    IReadOnlyList<OrganizationImportSourceCell> SourceCells,
    OrganizationImportResolutionKind? PreferredResolution,
    IReadOnlyList<OrganizationImportResolutionKind> AllowedResolutions);

/// <summary>
/// The interpreter's full, internal result: the Match-side reading of the source and, once Match
/// is complete, the canonical draft and its deterministic validation. Clients see Match through
/// <see cref="OrganizationImportMatchDto"/> and Review through <see cref="OrganizationImportReviewDto"/>.
/// </summary>
public sealed record OrganizationImportInterpretation(
    OrganizationImportShape Shape,
    OrganizationImportResolutionStatus ShapeStatus,
    OrganizationImportResolutionOrigin ShapeOrigin,
    IReadOnlyList<OrganizationImportFieldMapping> FieldMappings,
    IReadOnlyList<OrganizationImportTypeOption> TypeOptions,
    IReadOnlyList<OrganizationImportProposalNode> ProposalNodes,
    IReadOnlyList<OrganizationImportIgnoredColumn> IgnoredColumns,
    OrganizationImportMappingPlan MappingPlan,
    OrganizationImportMatchReadiness MatchReadiness,
    CanonicalOrganizationDraft? CanonicalDraft,
    OrganizationImportValidationResult? Validation,
    IReadOnlyList<OrganizationImportReviewAnchor> Anchors)
{
    public bool CanPublish => MatchReadiness.CanContinue && Validation is { HasBlockingIssues: false };
}

public sealed record OrganizationImportReviewReadiness(
    OrganizationImportReviewState State,
    bool CanPublish,
    int BlockingIssueCount,
    int WarningCount,
    int CreateCount,
    int ExistingCount);

public sealed record OrganizationImportTypeCount(Guid? TypeId, string TypeName, int Count);

public sealed record OrganizationImportReviewSummary(
    int TotalUnits,
    int NewUnits,
    int ExistingUnits,
    int ConflictUnits,
    int RootCount,
    IReadOnlyList<OrganizationImportTypeCount> CountsByType);

public sealed record OrganizationImportReviewNodeDto(
    string ProposalNodeId,
    string BusinessCode,
    bool BusinessCodeGenerated,
    string Name,
    Guid? TypeId,
    string? TypeName,
    string? ParentProposalNodeId,
    Guid? ParentExistingUnitId,
    Guid? ExistingOrgUnitId,
    OrganizationImportNodeClassification Classification,
    bool IsRoot,
    int Depth,
    int BlockingIssueCount,
    int WarningCount,
    IReadOnlyList<OrganizationImportSourceCell> SourceCells,
    IReadOnlyList<OrganizationImportCandidate> Candidates,
    IReadOnlyList<OrganizationImportIdentityEvidence> IdentityEvidence);

/// <summary>An existing unit the proposal hangs from, with its ancestors, so the hierarchy renders connected.</summary>
public sealed record OrganizationImportReviewAnchor(Guid Id, string Name, string BusinessCode, string? TypeName, Guid? ParentId, bool IsRoot);

public sealed record OrganizationImportReviewResolutions(
    OrganizationImportRootDecision? IntroducedRoot,
    IReadOnlyDictionary<string, Guid> AcceptedExistingMatches,
    IReadOnlyList<string> KeepExistingNodeIds);

/// <summary>
/// The one authoritative Review read: the exact canonical organization Fusion intends to establish,
/// its deterministic issues and publication readiness. Null until Match is complete.
/// </summary>
public sealed record OrganizationImportReviewDto(
    DateOnly EffectiveDate,
    string ProposalFingerprint,
    int DecisionRevision,
    OrganizationImportReviewReadiness Readiness,
    OrganizationImportReviewSummary Summary,
    IReadOnlyList<OrganizationImportReviewNodeDto> Nodes,
    IReadOnlyList<OrganizationImportReviewAnchor> Anchors,
    IReadOnlyList<OrganizationImportIssue> Issues,
    OrganizationImportReviewResolutions Resolutions);

public sealed record UpdateOrganizationImportMatchRequest(
    OrganizationImportShape? Shape = null,
    IReadOnlyDictionary<string, int?>? FieldMappings = null,
    IReadOnlyDictionary<string, Guid>? TypeMappings = null,
    OrganizationImportGeneratedIdentityStrategy? IdentityStrategy = null);

/// <summary>The complete set of bounded Review resolutions; it replaces the current set.</summary>
public sealed record UpdateOrganizationImportReviewResolutionsRequest(
    OrganizationImportRootDecision? IntroducedRoot = null,
    IReadOnlyDictionary<string, Guid>? AcceptedExistingMatches = null,
    IReadOnlyCollection<string>? KeepExistingNodeIds = null);

public sealed record CommitOrganizationImportRequest(string ProposalFingerprint);
public sealed record OrganizationImportCreatedUnit(string ProposalNodeId, Guid OrgUnitId, string BusinessCode, string Name);
public sealed record OrganizationImportCommitResult(Guid SessionId, DateOnly EffectiveDate, IReadOnlyList<OrganizationImportCreatedUnit> CreatedUnits, bool NoChanges);
public sealed record OrganizationImportProvenance(string ProposalNodeId, Guid? OrgUnitId, IReadOnlyList<OrganizationImportSourceCell> SourceCells, string Resolution);

public sealed class OrganizationImportReviewException(string code, string safeMessage, int statusCode = StatusCodes.Status422UnprocessableEntity)
    : Exception(safeMessage)
{
    public string Code { get; } = code;
    public int StatusCode { get; } = statusCode;
}
