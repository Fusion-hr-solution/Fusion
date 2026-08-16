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
        var issues = BuildIssues(session, review, fields, hasOrderedLevelPattern);
        if (issues.Count == 0) return null;

        var structure = new OrganizationImportSemanticStructuralContext(
            table.Rows.Count,
            table.Columns.Count,
            hasOrderedLevelPattern,
            plausibleShapes);
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

        if (hasOrderedLevelPattern || review.Shape == OrganizationImportShape.LevelColumns)
        {
            foreach (var field in fields)
            {
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
