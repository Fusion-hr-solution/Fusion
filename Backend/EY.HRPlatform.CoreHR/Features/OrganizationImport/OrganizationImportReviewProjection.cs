using EY.HRPlatform.CoreHR.Infrastructure.Imports;
namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

/// <summary>
/// Projects an interpretation into the one authoritative Review read. Everything here is derived
/// from the canonical draft and its validation; clients never reconstruct readiness or counts.
/// </summary>
public static class OrganizationImportReviewProjection
{
    public static OrganizationImportReviewDto? Create(
        OrganizationImportInterpretation interpretation,
        OrganizationImportDecisions decisions,
        int decisionRevision)
    {
        if (!interpretation.MatchReadiness.CanContinue
            || interpretation.CanonicalDraft is not { } draft
            || interpretation.Validation is not { } validation)
            return null;

        var issues = validation.Issues;
        var blockers = issues.Count(issue => issue.Severity == ImportIssueSeverity.Blocker);
        var warnings = issues.Count - blockers;
        var placed = draft.Nodes.Where(node => node.Classification != OrganizationImportNodeClassification.Conflict).ToList();
        var creates = placed.Count(node => node.Classification == OrganizationImportNodeClassification.Create);
        var existing = placed.Count - creates;
        var proposalById = interpretation.ProposalNodes.ToDictionary(node => node.Id, StringComparer.Ordinal);
        var depths = Depths(draft, interpretation.Anchors);
        var counts = IssueCounts(issues);

        var nodes = draft.Nodes.Select(node =>
        {
            var proposal = proposalById[node.Id];
            counts.TryGetValue(node.Id, out var count);
            return new OrganizationImportReviewNodeDto(
                node.Id, node.BusinessCode, node.BusinessCodeGenerated, node.Name, node.TypeId, node.TypeName,
                node.ParentNodeId, node.ParentExistingUnitId, node.ExistingOrgUnitId, node.Classification, node.IsRoot,
                depths.GetValueOrDefault(node.Id), count.Blocking, count.Warning,
                node.SourceReference, proposal.DescriptiveCandidates, proposal.IdentityEvidence);
        }).ToList();

        var tops = draft.PermanentRoot is not null
            ? 1
            : placed.Count(node => node.ParentNodeId is null && node.ParentExistingUnitId is null && !node.HasUnresolvedParent);
        var byType = placed
            .GroupBy(node => (node.TypeId, Name: node.TypeName ?? "No type"))
            .Select(group => new OrganizationImportTypeCount(group.Key.TypeId, group.Key.Name, group.Count()))
            .OrderByDescending(item => item.Count).ThenBy(item => item.TypeName, StringComparer.Ordinal)
            .ToList();

        return new OrganizationImportReviewDto(
            draft.EffectiveDate,
            draft.Fingerprint,
            decisionRevision,
            new OrganizationImportReviewReadiness(
                blockers > 0 ? OrganizationImportReviewState.Blocked
                    : warnings > 0 ? OrganizationImportReviewState.ReadyWithWarnings
                    : OrganizationImportReviewState.Ready,
                interpretation.CanPublish,
                blockers,
                warnings,
                creates,
                existing),
            new OrganizationImportReviewSummary(placed.Count, creates, existing, draft.Nodes.Count - placed.Count, tops, byType),
            nodes,
            interpretation.Anchors,
            issues,
            new OrganizationImportReviewResolutions(
                decisions.IntroducedRoot,
                decisions.AcceptedExistingMatches ?? new Dictionary<string, Guid>(),
                (decisions.KeepExistingNodeIds ?? []).ToList()));
    }

    private static Dictionary<string, (int Blocking, int Warning)> IssueCounts(IReadOnlyList<OrganizationImportIssue> issues)
    {
        var counts = new Dictionary<string, (int Blocking, int Warning)>(StringComparer.Ordinal);
        foreach (var issue in issues)
            foreach (var id in issue.RelatedNodeIds.Prepend(issue.ProposalNodeId).OfType<string>().Distinct(StringComparer.Ordinal))
            {
                var current = counts.GetValueOrDefault(id);
                counts[id] = issue.Severity == ImportIssueSeverity.Blocker
                    ? (current.Blocking + 1, current.Warning)
                    : (current.Blocking, current.Warning + 1);
            }
        return counts;
    }

    /// <summary>Depth in the resulting hierarchy, counting existing ancestors; a loop is treated as depth 0.</summary>
    private static Dictionary<string, int> Depths(CanonicalOrganizationDraft draft, IReadOnlyList<OrganizationImportReviewAnchor> anchors)
    {
        var byId = draft.Nodes.ToDictionary(node => node.Id, StringComparer.Ordinal);
        var existingNodeByUnit = draft.Nodes.Where(node => node.ExistingOrgUnitId is not null
                && node.Classification == OrganizationImportNodeClassification.Existing)
            .GroupBy(node => node.ExistingOrgUnitId!.Value).ToDictionary(group => group.Key, group => group.First().Id);
        var anchorById = anchors.ToDictionary(anchor => anchor.Id);
        var depths = new Dictionary<string, int>(StringComparer.Ordinal);

        int OfExisting(Guid unitId, HashSet<string> path)
        {
            if (existingNodeByUnit.TryGetValue(unitId, out var nodeId)) return Of(nodeId, path);
            var depth = 0;
            var cursor = anchorById.GetValueOrDefault(unitId);
            var seen = new HashSet<Guid>();
            while (cursor?.ParentId is Guid parent && seen.Add(cursor.Id))
            {
                depth++;
                if (existingNodeByUnit.TryGetValue(parent, out var parentNode)) return depth + Of(parentNode, path);
                cursor = anchorById.GetValueOrDefault(parent);
            }
            return depth;
        }

        int Of(string id, HashSet<string> path)
        {
            if (depths.TryGetValue(id, out var known)) return known;
            if (!path.Add(id)) return 0;
            var node = byId[id];
            var depth = node.ParentNodeId is { } parent && byId.ContainsKey(parent) ? Of(parent, path) + 1
                : node.ParentExistingUnitId is Guid unit ? OfExisting(unit, path) + 1
                : 0;
            depths[id] = depth;
            return depth;
        }

        foreach (var node in draft.Nodes) Of(node.Id, new HashSet<string>(StringComparer.Ordinal));
        return depths;
    }
}
