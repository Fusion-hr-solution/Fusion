using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public interface IOrganizationImportSemanticContextBuilder
{
    OrganizationImportSemanticRequest? Build(
        OrganizationImportSession session,
        OrganizationImportReview review);
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
        "fusionorgunitid", "orgunitid",
    ];

    public OrganizationImportSemanticRequest? Build(
        OrganizationImportSession session,
        OrganizationImportReview review)
    {
        if (session.Status != OrganizationImportStatus.Active) return null;
        var table = OrganizationImportJson.Deserialize(session.Source.SourceTableJson);
        if (table is null || table.Columns.Count == 0 || table.Rows.Count == 0) return null;

        var fieldLimit = Math.Clamp(options.MaxFields, 1, 32);
        var valuesPerField = Math.Clamp(options.MaxValuesPerField, 1, 8);
        var totalValueLimit = Math.Clamp(options.MaxTotalValues, 1, 64);
        var valueCharacterLimit = Math.Clamp(options.MaxValueCharacters, 16, 120);
        var payloadLimit = Math.Clamp(options.MaxPayloadBytes, 4 * 1024, 20 * 1024);
        var fields = new List<OrganizationImportSemanticFieldContext>();
        var remainingValues = totalValueLimit;

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

            var distinct = values
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
                .ToList();
            var samples = distinct
                .Where(IsSafeRepresentativeValue)
                .Take(Math.Min(valuesPerField, remainingValues))
                .Select(value => value[..Math.Min(value.Length, valueCharacterLimit)])
                .ToList();
            remainingValues -= samples.Count;
            fields.Add(new OrganizationImportSemanticFieldContext(
                column.Index,
                label[..Math.Min(label.Length, valueCharacterLimit)],
                samples,
                values.Count,
                distinct.Count));
        }

        if (fields.Count == 0) return null;
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
        if (issues.Count == 0) return null;

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
        var decisions = (OrganizationImportJson.Deserialize<OrganizationImportDecisions>(session.DecisionsJson)
            ?? new OrganizationImportDecisions()).Normalize();

        while (true)
        {
            var fingerprintPayload = new
            {
                contractVersion = options.ContractVersion,
                sourceFingerprint,
                issues,
                fields,
                organizationTypes = review.TypeOptions.OrderBy(type => type.Id),
                structure,
                sourceTypeSystem,
                canonicalTypeGuidance,
                decisions = new
                {
                    decisions.Shape,
                    fieldMappings = decisions.FieldMappings!.OrderBy(item => item.Key),
                    typeMappings = decisions.TypeMappings!.OrderBy(item => item.Key),
                },
            };
            var serialized = JsonSerializer.Serialize(fingerprintPayload);
            if (Encoding.UTF8.GetByteCount(serialized) <= payloadLimit)
            {
                var fingerprint = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(serialized)));
                return new OrganizationImportSemanticRequest(
                    options.ContractVersion,
                    sourceFingerprint,
                    issues,
                    fields,
                    review.TypeOptions.OrderBy(type => type.Name, StringComparer.OrdinalIgnoreCase).ToList(),
                    structure,
                    sourceTypeSystem,
                    canonicalTypeGuidance,
                    fingerprint);
            }

            var fieldWithSample = fields.LastOrDefault(field => field.RepresentativeValues.Count > 0);
            if (fieldWithSample is null) return null;
            var index = fields.IndexOf(fieldWithSample);
            fields[index] = fieldWithSample with
            {
                RepresentativeValues = fieldWithSample.RepresentativeValues.Take(fieldWithSample.RepresentativeValues.Count - 1).ToList(),
            };
        }
    }

    private static List<OrganizationImportSemanticIssue> BuildIssues(
        OrganizationImportSession session,
        OrganizationImportReview review,
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
            foreach (var field in fields)
            {
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

    /// <summary>
    /// Distil the proposal into per-source-type topology evidence: for each distinct raw type, how
    /// many units use it, the depths it appears at, its observed parent/child types, whether it sits
    /// on the structural root, and whether it is leaf-only. Derived from the deterministic proposal
    /// graph (parent links + root), so the model receives facts, not guesses.
    /// </summary>
    private static IReadOnlyList<OrganizationImportSemanticSourceType> BuildSourceTypeSystem(OrganizationImportReview review)
    {
        var nodes = review.ProposalNodes;
        if (nodes.Count == 0) return [];
        var byId = nodes.Where(n => n.Id is not null).ToDictionary(n => n.Id, StringComparer.Ordinal);
        string? TypeOf(OrganizationImportReviewNode n) => string.IsNullOrWhiteSpace(n.RawType) ? n.TypeName : n.RawType;

        // Depth from the structural root via parent links (bounded against cycles).
        int Depth(OrganizationImportReviewNode n)
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
            var sampleNames = members
                .Select(n => n.Name).Where(name => !string.IsNullOrWhiteSpace(name) && IsSafeRepresentativeValue(name))
                .Distinct(StringComparer.OrdinalIgnoreCase).Take(3)
                .Select(name => name[..Math.Min(name.Length, 40)]).ToList();

            result.Add(new OrganizationImportSemanticSourceType(
                group.Key, members.Count, depths.Min(), depths.Max(), parentTypes, childTypes, occursOnRoot, leafOnly, sampleNames));
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

    private static bool IsSafeRepresentativeValue(string value)
    {
        if (value.Length == 0 || value.Contains('@') || Guid.TryParse(value, out _)) return false;
        var digits = value.Count(char.IsDigit);
        if (digits >= 7 && digits * 2 >= value.Length) return false;
        return !PhoneLike().IsMatch(value);
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string Normalize(string value) => new(value.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
    private static string HashKey(string value)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value.Trim().ToLowerInvariant())))[..16];

    [GeneratedRegex(@"^\+?[\d\s().-]{7,}$", RegexOptions.CultureInvariant)]
    private static partial Regex PhoneLike();
}
