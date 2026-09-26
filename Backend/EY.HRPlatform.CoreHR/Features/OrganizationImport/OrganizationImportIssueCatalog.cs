using EY.HRPlatform.CoreHR.Infrastructure.Imports;
namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

/// <summary>Stable codes for canonical-result issues. Review never carries Match-stage findings.</summary>
public static class OrganizationImportIssueCodes
{
    public const string MissingName = "MissingName";
    public const string InvalidType = "InvalidType";
    public const string MissingParent = "MissingParent";
    public const string SelfParent = "SelfParent";
    public const string HierarchyCycle = "HierarchyCycle";
    public const string DuplicateBusinessCode = "DuplicateBusinessCode";
    public const string InvalidBusinessCode = "InvalidBusinessCode";
    public const string BusinessCodeTaken = "BusinessCodeTaken";
    public const string MultipleRoots = "MultipleRoots";
    public const string SecondOrganizationRoot = "SecondOrganizationRoot";
    public const string EmptyOrganization = "EmptyOrganization";
    public const string IdentityContradiction = "IdentityContradiction";
    public const string UnknownFusionId = "UnknownFusionId";
    public const string RootUnavailableAsOfDate = "RootUnavailableAsOfDate";
    public const string ExistingUnavailableAsOfDate = "ExistingUnavailableAsOfDate";
    public const string ExistingDifference = "ExistingDifference";
    public const string DuplicateDisplayName = "DuplicateDisplayName";
    public const string PossibleExistingUnit = "PossibleExistingUnit";
}

/// <summary>
/// The single authority for what a Review issue is: its severity, its title, and the default
/// pathways to a fix (preferred first). Issue builders may narrow or reorder the pathways from the
/// issue's actual context, but severity is decided here only.
/// </summary>
public static class OrganizationImportIssueCatalog
{
    private const ImportIssueSeverity Blocker = ImportIssueSeverity.Blocker;
    private const ImportIssueSeverity Warning = ImportIssueSeverity.Warning;
    private const OrganizationImportResolutionKind Match = OrganizationImportResolutionKind.ReturnToMatch;
    private const OrganizationImportResolutionKind Source = OrganizationImportResolutionKind.CorrectSource;
    private const OrganizationImportResolutionKind Date = OrganizationImportResolutionKind.ChangeEffectiveDate;

    private sealed record Entry(ImportIssueSeverity Severity, string Title, OrganizationImportResolutionKind[] Resolutions);

    private static readonly Dictionary<string, Entry> Entries = new(StringComparer.Ordinal)
    {
        [OrganizationImportIssueCodes.MissingName] = new(Blocker, "Unit has no name", [Source]),
        [OrganizationImportIssueCodes.InvalidType] = new(Blocker, "Unit has no type", [Match]),
        [OrganizationImportIssueCodes.MissingParent] = new(Blocker, "Parent not found", [Source, Match]),
        [OrganizationImportIssueCodes.SelfParent] = new(Blocker, "Unit is its own parent", [Source, Match]),
        [OrganizationImportIssueCodes.HierarchyCycle] = new(Blocker, "Units loop back on each other", [Source, Match]),
        [OrganizationImportIssueCodes.DuplicateBusinessCode] = new(Blocker, "Business code used twice", [Source, Match]),
        [OrganizationImportIssueCodes.InvalidBusinessCode] = new(Blocker, "Business code isn't valid", [Source]),
        [OrganizationImportIssueCodes.BusinessCodeTaken] = new(Blocker, "Business code already in use", [Source]),
        [OrganizationImportIssueCodes.MultipleRoots] = new(Blocker, "More than one top-level unit", [OrganizationImportResolutionKind.AddOrganizationRoot, Source]),
        [OrganizationImportIssueCodes.SecondOrganizationRoot] = new(Blocker, "Second Organization unit", [Match, Source]),
        [OrganizationImportIssueCodes.EmptyOrganization] = new(Blocker, "Nothing to import", [Source]),
        [OrganizationImportIssueCodes.IdentityContradiction] = new(Blocker, "Row points to two units", [Source]),
        [OrganizationImportIssueCodes.UnknownFusionId] = new(Blocker, "Unit ID not found", [Source]),
        [OrganizationImportIssueCodes.RootUnavailableAsOfDate] = new(Blocker, "Organization root isn't active on this date", [Date]),
        [OrganizationImportIssueCodes.ExistingUnavailableAsOfDate] = new(Blocker, "Existing unit isn't active on this date", [Date]),
        [OrganizationImportIssueCodes.ExistingDifference] = new(Blocker, "Differs from the existing unit", [OrganizationImportResolutionKind.KeepExisting, Source]),
        [OrganizationImportIssueCodes.DuplicateDisplayName] = new(Warning, "Same name in different places", []),
        [OrganizationImportIssueCodes.PossibleExistingUnit] = new(Warning, "Might already exist", [OrganizationImportResolutionKind.ChooseExistingUnit]),
    };

    public static IReadOnlyCollection<string> Codes => Entries.Keys;

    public static ImportIssueSeverity SeverityOf(string code) => Entries[code].Severity;

    public static IReadOnlyList<OrganizationImportResolutionKind> DefaultResolutions(string code) => Entries[code].Resolutions;

    /// <summary>Builds an issue about one unit.</summary>
    public static OrganizationImportIssue ForNode(
        string code,
        string message,
        string nodeId,
        IEnumerable<OrganizationImportSourceCell>? cells = null,
        string? field = null,
        IReadOnlyList<OrganizationImportResolutionKind>? resolutions = null)
        => Create(code, message, nodeId, [], cells, field, resolutions);

    /// <summary>Builds an issue that concerns several units together, such as a duplicate or a cycle.</summary>
    public static OrganizationImportIssue ForNodes(
        string code,
        string message,
        IReadOnlyList<string> nodeIds,
        IEnumerable<OrganizationImportSourceCell>? cells = null,
        string? field = null,
        IReadOnlyList<OrganizationImportResolutionKind>? resolutions = null)
        => Create(code, message, null, nodeIds, cells, field, resolutions);

    private static OrganizationImportIssue Create(
        string code,
        string message,
        string? nodeId,
        IReadOnlyList<string> related,
        IEnumerable<OrganizationImportSourceCell>? cells,
        string? field,
        IReadOnlyList<OrganizationImportResolutionKind>? resolutions)
    {
        var entry = Entries[code];
        var allowed = (resolutions ?? entry.Resolutions).Distinct().ToList();
        return new OrganizationImportIssue(
            code,
            entry.Severity,
            entry.Title,
            message,
            nodeId,
            related.Distinct(StringComparer.Ordinal).OrderBy(id => id, StringComparer.Ordinal).ToList(),
            field,
            (cells ?? []).Distinct().ToList(),
            allowed.Count > 0 ? allowed[0] : null,
            allowed);
    }
}
