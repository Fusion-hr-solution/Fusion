using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

/// <summary>
/// Turns the interpreter's proposal into the canonical draft: the source-format-neutral publication
/// boundary. Everything downstream (validation, Review, publication) sees canonical nodes only.
/// </summary>
public static class OrganizationImportDraftBuilder
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>The proposal id of an organization root the administrator added in Review.</summary>
    public const string IntroducedRootId = "root:introduced";

    public static CanonicalOrganizationDraft Build(
        DateOnly effectiveDate,
        IReadOnlyList<OrganizationImportProposalNode> proposal,
        CanonicalOrganizationRoot? permanentRoot)
    {
        var nodes = proposal
            .Select(node => new CanonicalOrganizationDraftNode(
                node.Id,
                node.BusinessCode ?? string.Empty,
                node.BusinessCodeGenerated,
                node.Name,
                node.TypeId,
                node.TypeName,
                node.ParentNodeId,
                node.ParentCanonicalId,
                node.CanonicalId,
                node.Classification,
                node.IsProposalRoot,
                node.HasUnresolvedParent,
                node.SourceCells))
            .OrderBy(node => node.Id, StringComparer.Ordinal)
            .ToList();
        return new CanonicalOrganizationDraft(effectiveDate, nodes, permanentRoot, Fingerprint(effectiveDate, nodes));
    }

    /// <summary>
    /// The reviewed-proposal identity: everything publication depends on (identity, name, parent,
    /// type, classification, effective date), ordered by stable node id rather than presentation.
    /// </summary>
    private static string Fingerprint(DateOnly effectiveDate, IReadOnlyList<CanonicalOrganizationDraftNode> nodes)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
        {
            effectiveDate,
            nodes = nodes.Select(node => new
            {
                node.Id,
                node.BusinessCode,
                node.Name,
                node.TypeId,
                node.ParentNodeId,
                node.ParentExistingUnitId,
                node.ExistingOrgUnitId,
                node.Classification,
                node.IsRoot,
                node.HasUnresolvedParent,
            }),
        }, Json))));
}

public interface IOrganizationImportValidator
{
    OrganizationImportValidationResult Validate(
        CanonicalOrganizationDraft draft,
        IReadOnlyList<OrganizationImportIssue> sourceIssues);
}

/// <summary>
/// Deterministic graph validation of the canonical draft. It is unaware of source shape and AI, and
/// it is the only place structural rules (names, types, parents, cycles, roots, codes) are checked.
/// Source-bound findings (unresolved references, identity reconciliation) arrive from the interpreter.
/// </summary>
public sealed class OrganizationImportValidator : IOrganizationImportValidator
{
    private const int MaxBusinessCodeLength = 50;

    public OrganizationImportValidationResult Validate(
        CanonicalOrganizationDraft draft,
        IReadOnlyList<OrganizationImportIssue> sourceIssues)
    {
        var issues = sourceIssues.ToList();
        var byId = draft.Nodes.ToDictionary(node => node.Id, StringComparer.Ordinal);
        var placed = draft.Nodes.Where(node => node.Classification != OrganizationImportNodeClassification.Conflict).ToList();
        var creates = placed.Where(node => node.Classification == OrganizationImportNodeClassification.Create).ToList();

        if (draft.Nodes.Count == 0)
            issues.Add(OrganizationImportIssueCatalog.ForNodes(OrganizationImportIssueCodes.EmptyOrganization,
                "The file has no units.", []));

        foreach (var node in creates)
        {
            if (string.IsNullOrWhiteSpace(node.Name))
                issues.Add(OrganizationImportIssueCatalog.ForNode(OrganizationImportIssueCodes.MissingName,
                    "Every unit needs a name.", node.Id, node.SourceReference, OrganizationImportFields.Name));
            if (node.TypeId is null)
                issues.Add(OrganizationImportIssueCatalog.ForNode(OrganizationImportIssueCodes.InvalidType,
                    $"{Label(node)} has no type.", node.Id, node.SourceReference, OrganizationImportFields.Type));
            if (node.ParentNodeId == node.Id)
                issues.Add(OrganizationImportIssueCatalog.ForNode(OrganizationImportIssueCodes.SelfParent,
                    $"{Label(node)} lists itself as parent.", node.Id, node.SourceReference, OrganizationImportFields.ParentBusinessCode));
            else if (node.ParentNodeId is not null && !byId.ContainsKey(node.ParentNodeId))
                issues.Add(OrganizationImportIssueCatalog.ForNode(OrganizationImportIssueCodes.MissingParent,
                    $"{Label(node)}’s parent isn't in the file.", node.Id, node.SourceReference, OrganizationImportFields.ParentBusinessCode));
            if (!node.BusinessCodeGenerated && !IsValidCode(node.BusinessCode))
                issues.Add(OrganizationImportIssueCatalog.ForNode(OrganizationImportIssueCodes.InvalidBusinessCode,
                    "Use letters, numbers, - or _ (max 50).",
                    node.Id, node.SourceReference, OrganizationImportFields.BusinessCode,
                    node.Id == OrganizationImportDraftBuilder.IntroducedRootId ? [OrganizationImportResolutionKind.AddOrganizationRoot] : null));
        }

        foreach (var duplicate in creates.Where(node => node.BusinessCode.Length > 0)
                     .GroupBy(node => node.BusinessCode, StringComparer.OrdinalIgnoreCase).Where(group => group.Count() > 1))
            issues.Add(OrganizationImportIssueCatalog.ForNodes(OrganizationImportIssueCodes.DuplicateBusinessCode,
                $"'{duplicate.Key}' is used by {duplicate.Count()} units.",
                duplicate.Select(node => node.Id).ToList(), duplicate.SelectMany(node => node.SourceReference), OrganizationImportFields.BusinessCode));

        foreach (var cycle in Cycles(creates, byId))
            issues.Add(OrganizationImportIssueCatalog.ForNodes(OrganizationImportIssueCodes.HierarchyCycle,
                $"{cycle.Count} units are each other's parents.",
                cycle, cycle.SelectMany(id => byId[id].SourceReference), OrganizationImportFields.ParentBusinessCode));

        // A fresh organization has exactly one top. Units whose parent reference didn't resolve are
        // reported as MissingParent and are not tops; an existing permanent root is the top otherwise.
        if (draft.PermanentRoot is null)
        {
            var tops = creates.Where(node => node.ParentNodeId is null && node.ParentExistingUnitId is null && !node.HasUnresolvedParent).ToList();
            if (tops.Count > 1)
                issues.Add(OrganizationImportIssueCatalog.ForNodes(OrganizationImportIssueCodes.MultipleRoots,
                    $"{tops.Count} units have no parent. Add one root above them.",
                    tops.Select(node => node.Id).ToList(), tops.SelectMany(node => node.SourceReference)));
        }

        foreach (var sameName in placed.Where(node => !string.IsNullOrWhiteSpace(node.Name))
                     .GroupBy(node => NormalizeName(node.Name), StringComparer.Ordinal)
                     .Where(group => group.Count() > 1
                         && group.Select(node => node.ParentNodeId ?? node.ParentExistingUnitId?.ToString()).Distinct().Count() > 1))
            issues.Add(OrganizationImportIssueCatalog.ForNodes(OrganizationImportIssueCodes.DuplicateDisplayName,
                $"'{sameName.First().Name.Trim()}' appears {sameName.Count()} times.",
                sameName.Select(node => node.Id).ToList()));

        var ordered = issues
            .OrderBy(issue => issue.Severity)
            .ThenBy(issue => issue.Code, StringComparer.Ordinal)
            .ThenBy(issue => issue.ProposalNodeId ?? issue.RelatedNodeIds.FirstOrDefault(), StringComparer.Ordinal)
            .ToList();
        return new OrganizationImportValidationResult(
            ordered,
            ordered.Any(issue => issue.Severity == ImportIssueSeverity.Blocker),
            draft.Fingerprint);
    }

    /// <summary>Each distinct parent loop among proposed units, as its member ids.</summary>
    private static List<List<string>> Cycles(
        IReadOnlyList<CanonicalOrganizationDraftNode> nodes,
        IReadOnlyDictionary<string, CanonicalOrganizationDraftNode> byId)
    {
        var state = new Dictionary<string, int>(StringComparer.Ordinal); // 1 = on the current path, 2 = settled
        var cycles = new List<List<string>>();
        foreach (var start in nodes.OrderBy(node => node.Id, StringComparer.Ordinal))
        {
            var path = new List<string>();
            var cursor = start.Id;
            while (cursor is not null && !state.ContainsKey(cursor))
            {
                state[cursor] = 1;
                path.Add(cursor);
                var parent = byId[cursor].ParentNodeId;
                cursor = parent is not null && parent != byId[cursor].Id && byId.ContainsKey(parent) ? parent : null;
            }
            if (cursor is not null && state[cursor] == 1)
                cycles.Add(path.Skip(path.IndexOf(cursor)).ToList());
            foreach (var id in path) state[id] = 2;
        }
        return cycles;
    }

    private static bool IsValidCode(string code)
        => code.Length is >= 1 and <= MaxBusinessCodeLength
           && code.All(character => char.IsLetterOrDigit(character) || character is '-' or '_');

    private static string Label(CanonicalOrganizationDraftNode node)
        => string.IsNullOrWhiteSpace(node.Name) ? "This unit" : $"'{node.Name.Trim()}'";

    private static string NormalizeName(string value)
        => new(value.Trim().ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
}
