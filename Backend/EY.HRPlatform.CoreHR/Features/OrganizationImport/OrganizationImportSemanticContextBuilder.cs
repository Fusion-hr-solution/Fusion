using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public interface IOrganizationImportSemanticContextBuilder
{
    /// <summary>
    /// The semantic questions deterministic interpretation left open, with only the bounded
    /// evidence they need. No request means nothing to ask, or the evidence would not fit.
    /// </summary>
    OrganizationImportSemanticContext Build(
        OrganizationImportSession session,
        OrganizationImportInterpretation review);
}

public sealed partial class OrganizationImportSemanticContextBuilder(
    OrganizationImportSemanticAssistanceOptions options) : IOrganizationImportSemanticContextBuilder
{
    private static readonly HashSet<string> AllowedFields = new(StringComparer.Ordinal)
    {
        OrganizationImportFields.Name,
        OrganizationImportFields.BusinessCode,
        OrganizationImportFields.Type,
        OrganizationImportFields.ParentBusinessCode,
    };

    private static readonly string[] SensitiveLabelParts =
    [
        "employee", "worker", "person", "email", "phone", "mobile", "salary", "compensation",
        "nationalid", "governmentid", "passport", "socialsecurity", "birth", "dob", "note", "comment",
        "fusionorgunitid", "orgunitid", "countryfootprint",
    ];

    public OrganizationImportSemanticContext Build(
        OrganizationImportSession session,
        OrganizationImportInterpretation review)
    {
        if (session.Status != OrganizationImportStatus.Active) return OrganizationImportSemanticContext.NoQuestions;
        var table = OrganizationImportJson.Deserialize(session.Source.SourceTableJson);
        if (table is null || table.Columns.Count == 0 || table.Rows.Count == 0) return OrganizationImportSemanticContext.NoQuestions;

        var fieldLimit = Math.Clamp(options.MaxFields, 1, 32);
        var valueCharacterLimit = Math.Clamp(options.MaxValueCharacters, 16, 120);
        var payloadLimit = Math.Clamp(options.MaxPayloadBytes, 4 * 1024, 20 * 1024);
        var valuesPerField = Math.Clamp(options.MaxValuesPerField, 1, 5);
        var fields = new List<OrganizationImportSemanticFieldContext>();

        foreach (var column in table.Columns.OrderBy(column => column.Index).Take(fieldLimit))
        {
            var label = Clean(column.SourceLabel) ?? $"Column {column.Index + 1}";
            if (IsSensitiveLabel(label)) continue;

            var values = table.Rows
                .Select(row => column.Index < row.Count ? Clean(row[column.Index]) : null)
                .Where(value => value is not null)
                .Select(value => value!)
                .ToList();
            if (values.Count == 0) continue;

            fields.Add(new OrganizationImportSemanticFieldContext(
                column.Index,
                label[..Math.Min(label.Length, valueCharacterLimit)],
                values.Count,
                values.Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                table.Rows.Count == 0 ? 0 : decimal.Round((decimal)values.Count / table.Rows.Count, 3),
                BasicValueShape(values),
                RepresentativeValues(values, valuesPerField)
                    .Select(value => value[..Math.Min(value.Length, valueCharacterLimit)])
                    .ToList()));
        }

        if (fields.Count == 0) return OrganizationImportSemanticContext.NoQuestions;
        var hasParentReferenceEvidence = OrganizationImportShapeEvidence.HasParentReferenceStructure(table);
        // A parent-reference table is often rectangular, so the ordered-level pattern
        // alone would misread it as level columns. The self-referential foreign key is
        // the authority: when it is present the columns are field roles, not levels.
        var hasOrderedLevelPattern =
            !hasParentReferenceEvidence
            && HasOrderedLevelPattern(table, fields.Select(field => field.ColumnIndex).ToList());
        var plausibleShapes = hasOrderedLevelPattern
            ? new[] { OrganizationImportShape.LevelColumns.ToString(), OrganizationImportShape.ParentReference.ToString() }
            : new[] { OrganizationImportShape.ParentReference.ToString(), OrganizationImportShape.LevelColumns.ToString() };
        var issues = BuildIssues(session, review, table, fields, hasOrderedLevelPattern);
        if (issues.Count == 0) return OrganizationImportSemanticContext.NoQuestions;

        // A set of one-off labels has no taxonomy to infer. Keep that decision in manual
        // review instead of asking a provider to invent meaning from organization content.
        if (issues.All(issue => issue.Kind == OrganizationImportSemanticKinds.OrganizationTypeMapping)
            && !HasCredibleTypeTaxonomy(review))
            return OrganizationImportSemanticContext.NoQuestions;

        // Provider context is intentionally limited to columns which are actually
        // unresolved.  A source's extra descriptive data is never useful for a
        // role-classification request and must not leave Fusion.
        var issueColumns = issues.Where(issue => issue.SourceColumnIndex is not null)
            .Select(issue => issue.SourceColumnIndex!.Value).ToHashSet();
        if (issues.Any(issue => issue.Kind == OrganizationImportSemanticKinds.SourceShape))
            issueColumns.UnionWith(fields.Select(field => field.ColumnIndex));
        fields = fields.Where(field => issueColumns.Contains(field.ColumnIndex)).ToList();
        var remainingValues = Math.Clamp(options.MaxTotalValues, 1, 64);
        fields = fields.Select(field =>
        {
            var kept = field.RepresentativeValues.Take(remainingValues).ToList();
            remainingValues -= kept.Count;
            return field with { RepresentativeValues = kept };
        }).ToList();

        var structure = new OrganizationImportSemanticStructuralContext(
            table.Rows.Count,
            table.Columns.Count,
            hasOrderedLevelPattern,
            plausibleShapes);
        // The source type SYSTEM (vocabulary + topology) and the canonical roles, so the model maps
        // the whole taxonomy coherently instead of classifying each label alone.
        var sourceTypeSystem = BuildSourceTypeSystem(review);
        var canonicalTypeGuidance = review.TypeOptions
            .Select(type => new OrganizationImportSemanticCanonicalType(type.Name, CanonicalTypeDescription(type.Name)))
            .ToList();
        var sourceFingerprint = $"{session.Source.Sha256}:{session.Source.SelectedSheetName}:{session.Source.SelectedRange}";

        // The input fingerprint covers exactly what is sent (questions, allowed targets, evidence)
        // under the data contract that governs it, so an identical input can reuse an earlier result
        // and any change in what would be asked is recognisable.
        var fingerprintPayload = new
        {
            dataContract = OrganizationImportSemanticVersions.DataContract,
            sourceFingerprint,
            issues,
            fields,
            organizationTypes = review.TypeOptions.OrderBy(type => type.Id),
            structure,
            sourceTypeSystem,
            canonicalTypeGuidance,
        };
        var serialized = JsonSerializer.Serialize(fingerprintPayload);
        if (Encoding.UTF8.GetByteCount(serialized) > payloadLimit) return OrganizationImportSemanticContext.OverBudget;
        var fingerprint = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(serialized)));
        return new(new OrganizationImportSemanticRequest(
            OrganizationImportSemanticVersions.ResultContract,
            sourceFingerprint,
            issues,
            fields,
            review.TypeOptions.OrderBy(type => type.Name, StringComparer.OrdinalIgnoreCase).ToList(),
            structure,
            sourceTypeSystem,
            canonicalTypeGuidance,
            fingerprint), false);
    }

    /// <summary>
    /// A few distinct values spread across the column, rather than the first rows, so the
    /// evidence reflects the column and not whatever the file happens to list first.
    /// </summary>
    private static IEnumerable<string> RepresentativeValues(IReadOnlyList<string> values, int count)
    {
        var distinct = values.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (distinct.Count <= count) return distinct;
        return Enumerable.Range(0, count)
            .Select(index => distinct[(int)((long)index * (distinct.Count - 1) / Math.Max(1, count - 1))])
            .Distinct(StringComparer.OrdinalIgnoreCase);
    }

    private static List<OrganizationImportSemanticIssue> BuildIssues(
        OrganizationImportSession session,
        OrganizationImportInterpretation review,
        OrganizationSourceTable table,
        IReadOnlyList<OrganizationImportSemanticFieldContext> fields,
        bool hasOrderedLevelPattern)
    {
        var issues = new List<OrganizationImportSemanticIssue>();
        var decisions = (OrganizationImportJson.Deserialize<OrganizationImportDecisions>(session.DecisionsJson)
            ?? new OrganizationImportDecisions()).Normalize();

        if (review.ShapeStatus == OrganizationImportResolutionStatus.Unresolved)
        {
            issues.Add(new OrganizationImportSemanticIssue(
                "shape",
                OrganizationImportSemanticKinds.SourceShape,
                null,
                null,
                [
                    new("shape:LevelColumns", "Level columns"),
                    new("shape:ParentReference", "Parent reference"),
                ]));
        }

        if (review.Shape == OrganizationImportShape.LevelColumns)
        {
            // Shape is settled and the proposal nodes already carry the level vocabulary as their
            // raw types; those unmapped types are asked exactly once below, as type-value questions.
            // Asking per column here as well would double every vocabulary decision.
        }
        else if (hasOrderedLevelPattern)
        {
            // Shape is still being inferred (no proposal nodes yet): ask the model to type each
            // level column so it can settle level-columns. Row keys the export carried along (an
            // index/No./id column) are not levels, so they are never offered a level type.
            OrganizationImportLevelEvidence.SelectLevelColumns(table, out var ignored);
            var ignoredColumns = ignored.Select(column => column.ColumnIndex).ToHashSet();
            foreach (var field in fields)
            {
                if (ignoredColumns.Contains(field.ColumnIndex)) continue;
                if (decisions.TypeMappings!.ContainsKey(field.SourceLabel)) continue;
                issues.Add(new OrganizationImportSemanticIssue(
                    $"level-type:{field.ColumnIndex}",
                    OrganizationImportSemanticKinds.OrganizationTypeMapping,
                    field.ColumnIndex,
                    field.SourceLabel,
                    review.TypeOptions.Select(type => new OrganizationImportSemanticTarget($"type:{type.Id}", type.Name)).ToList()));
            }
        }
        else
        {
            var resolvedFields = review.FieldMappings
                .Where(mapping => mapping.ColumnIndex is not null)
                .Select(mapping => mapping.Field)
                .ToHashSet(StringComparer.Ordinal);
            var resolvedColumns = review.FieldMappings
                .Where(mapping => mapping.ColumnIndex is not null)
                .Select(mapping => mapping.ColumnIndex!.Value)
                .ToHashSet();
            foreach (var field in fields)
            {
                if (resolvedColumns.Contains(field.ColumnIndex)) continue;
                var allowed = new List<OrganizationImportSemanticTarget>();
                AddFieldTarget(OrganizationImportFields.Name, "Name");
                AddFieldTarget(OrganizationImportFields.BusinessCode, "Business Code");
                AddFieldTarget(OrganizationImportFields.Type, "Type");
                AddFieldTarget(OrganizationImportFields.ParentBusinessCode, "Parent reference");
                if (allowed.Count == 0) continue;
                issues.Add(new OrganizationImportSemanticIssue(
                    $"field:{field.ColumnIndex}",
                    OrganizationImportSemanticKinds.FieldMapping,
                    field.ColumnIndex,
                    field.SourceLabel,
                    allowed));

                void AddFieldTarget(string key, string label)
                {
                    if (AllowedFields.Contains(key) && !resolvedFields.Contains(key))
                        allowed.Add(new OrganizationImportSemanticTarget($"field:{key}", label));
                }
            }
        }

        foreach (var rawType in review.ProposalNodes
                     .Where(node => node.TypeId is null && !string.IsNullOrWhiteSpace(node.RawType))
                     .Select(node => node.RawType!)
                     .Distinct(StringComparer.OrdinalIgnoreCase)
                     .OrderBy(value => value, StringComparer.OrdinalIgnoreCase))
        {
            if (decisions.TypeMappings!.ContainsKey(rawType)) continue;
            issues.Add(new OrganizationImportSemanticIssue(
                $"type-value:{HashKey(rawType)}",
                OrganizationImportSemanticKinds.OrganizationTypeMapping,
                review.FieldMappings.SingleOrDefault(mapping => mapping.Field == OrganizationImportFields.Type)?.ColumnIndex,
                rawType,
                review.TypeOptions.Select(type => new OrganizationImportSemanticTarget($"type:{type.Id}", type.Name)).ToList()));
        }

        return issues
            .Where(issue => issue.AllowedTargets.Count > 0)
            .OrderBy(issue => issue.SourceColumnIndex ?? -1)
            .ThenBy(issue => issue.Key, StringComparer.Ordinal)
            .ToList();
    }

    private static bool HasCredibleTypeTaxonomy(OrganizationImportInterpretation review)
    {
        var labels = review.ProposalNodes
            .Where(node => !string.IsNullOrWhiteSpace(node.RawType))
            .Select(node => node.RawType!)
            .GroupBy(label => label, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.Count())
            .ToList();
        return labels.Count >= 2 && labels.Any(count => count >= 2);
    }

    /// <summary>
    /// Distil the proposal into per-source-type topology evidence: for each distinct raw type, how
    /// many units use it, the depths it appears at, its observed parent/child types, whether it sits
    /// on the structural root, and whether it is leaf-only. Derived from the deterministic proposal
    /// graph (parent links + root), so the model receives facts, not guesses.
    /// </summary>
    private static IReadOnlyList<OrganizationImportSemanticSourceType> BuildSourceTypeSystem(OrganizationImportInterpretation review)
    {
        var nodes = review.ProposalNodes;
        if (nodes.Count == 0) return [];
        var byId = nodes.Where(n => n.Id is not null).ToDictionary(n => n.Id, StringComparer.Ordinal);
        string? TypeOf(OrganizationImportProposalNode n) => string.IsNullOrWhiteSpace(n.RawType) ? n.TypeName : n.RawType;

        // Depth from the structural root via parent links (bounded against cycles).
        int Depth(OrganizationImportProposalNode n)
        {
            var depth = 0;
            var seen = new HashSet<string>(StringComparer.Ordinal);
            var current = n;
            while (current.ParentNodeId is { } pid && seen.Add(current.Id) && byId.TryGetValue(pid, out var parent))
            {
                depth++;
                current = parent;
                if (depth > 64) break;
            }
            return depth;
        }

        var childTypesByParentId = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        foreach (var node in nodes)
            if (node.ParentNodeId is { } pid && TypeOf(node) is { } ct)
                (childTypesByParentId.TryGetValue(pid, out var set) ? set : childTypesByParentId[pid] = new(StringComparer.OrdinalIgnoreCase)).Add(ct);

        var groups = nodes
            .Where(n => TypeOf(n) is not null)
            .GroupBy(n => TypeOf(n)!, StringComparer.OrdinalIgnoreCase);

        var result = new List<OrganizationImportSemanticSourceType>();
        foreach (var group in groups.OrderBy(g => g.Key, StringComparer.OrdinalIgnoreCase))
        {
            var members = group.ToList();
            var depths = members.Select(Depth).ToList();
            var parentTypes = members
                .Where(n => n.ParentNodeId is not null && byId.TryGetValue(n.ParentNodeId, out _))
                .Select(n => TypeOf(byId[n.ParentNodeId!]))
                .Where(t => t is not null).Select(t => t!)
                .Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(t => t, StringComparer.OrdinalIgnoreCase).ToList();
            var childTypes = members
                .SelectMany(n => childTypesByParentId.TryGetValue(n.Id, out var set) ? set : Enumerable.Empty<string>())
                .Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(t => t, StringComparer.OrdinalIgnoreCase).ToList();
            var occursOnRoot = members.Any(n => n.IsProposalRoot);
            var leafOnly = childTypes.Count == 0;
            result.Add(new OrganizationImportSemanticSourceType(
                group.Key, members.Count, depths.Min(), depths.Max(), parentTypes, childTypes, occursOnRoot, leafOnly));
        }
        return result;
    }

    /// <summary>A short, source-neutral description of the organizational role each canonical Fusion
    /// type represents, so the model can align unfamiliar vocabulary to roles rather than names.</summary>
    private static string CanonicalTypeDescription(string typeName) => Normalize(typeName) switch
    {
        "organization" => "Enterprise/root organizational body — the single top of the organization.",
        "division" => "Major organizational branch directly beneath the enterprise.",
        "department" => "Functional grouping beneath a division or equivalent major branch.",
        "team" => "Operational/team-level grouping, commonly leaf-level.",
        "unit" => "Generic organizational unit when no more specific role applies.",
        "businessunit" => "Business unit — a mid-level operating grouping.",
        _ => $"Canonical organization type '{typeName}'.",
    };

    private static bool HasOrderedLevelPattern(OrganizationSourceTable table, IReadOnlyList<int> columnIndexes)
    {
        if (columnIndexes.Count < 2) return false;
        var nonEmptyRows = 0;
        var orderedRows = 0;
        foreach (var row in table.Rows)
        {
            var seenBlank = false;
            var hasValue = false;
            var ordered = true;
            foreach (var column in columnIndexes)
            {
                var value = column < row.Count ? Clean(row[column]) : null;
                if (value is null) seenBlank = true;
                else
                {
                    hasValue = true;
                    if (seenBlank) ordered = false;
                }
            }
            if (!hasValue) continue;
            nonEmptyRows++;
            if (ordered) orderedRows++;
        }
        return nonEmptyRows > 0 && orderedRows == nonEmptyRows;
    }

    private static bool IsSensitiveLabel(string label)
    {
        var normalized = Normalize(label);
        return SensitiveLabelParts.Any(normalized.Contains);
    }

    private static string BasicValueShape(IReadOnlyList<string> values)
    {
        if (values.All(value => Guid.TryParse(value, out _))) return "guid";
        if (values.All(value => decimal.TryParse(value, out _))) return "number";
        if (values.All(value => value.All(character => char.IsLetterOrDigit(character) || character is '-' or '_')))
            return "identifier-or-label";
        return "text";
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string Normalize(string value) => new(value.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
    private static string HashKey(string value)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value.Trim().ToLowerInvariant())))[..16];

}
