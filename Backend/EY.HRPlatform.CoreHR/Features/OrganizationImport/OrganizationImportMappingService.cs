using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Organization;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public interface IOrganizationImportMappingService
{
    OrganizationImportMappingPlan CreatePlan(
        OrganizationImportSession session,
        OrganizationSourceTable table,
        OrganizationImportDecisions decisions,
        IReadOnlyList<OrganizationImportTypeOption>? typeOptions = null,
        bool hasPermanentRoot = false);
}

/// <summary>
/// Builds the deterministic portion of the source interpretation. It has no database or provider
/// dependency, so the same source and decisions always produce the same mapping plan.
/// </summary>
public sealed class OrganizationImportMappingService : IOrganizationImportMappingService
{
    private static readonly string[] NativeHeaders = ["Fusion OrgUnit ID", "Business Code", "Name", "Type", "Parent Business Code"];
    private static readonly Dictionary<string, string[]> FieldAliases = new(StringComparer.Ordinal)
    {
        [OrganizationImportFields.FusionOrgUnitId] = ["fusion orgunit id", "fusion org unit id", "orgunit id", "org unit id"],
        [OrganizationImportFields.BusinessCode] = ["business code", "unit code", "org code", "code", "org key"],
        [OrganizationImportFields.Name] = ["name", "unit name", "organization name", "org name", "structure label"],
        [OrganizationImportFields.Type] = ["type", "unit type", "organization type", "org type", "layer label"],
        [OrganizationImportFields.ParentBusinessCode] = ["parent business code", "parent code", "reports to code", "parent", "upstream ref"],
    };

    public OrganizationImportMappingPlan CreatePlan(
        OrganizationImportSession session,
        OrganizationSourceTable table,
        OrganizationImportDecisions decisions,
        IReadOnlyList<OrganizationImportTypeOption>? typeOptions = null,
        bool hasPermanentRoot = false)
    {
        var labels = table.Columns.ToDictionary(column => column.Index, column => Normalize(column.SourceLabel));
        var native = table.Columns.Count == NativeHeaders.Length
            && NativeHeaders.Select(Normalize).SequenceEqual(table.Columns.Select(column => Normalize(column.SourceLabel)));
        var mappings = new List<OrganizationImportFieldMapping>();
        foreach (var field in FieldAliases.Keys)
        {
            if (decisions.FieldMappings!.TryGetValue(field, out var chosen))
            {
                var origin = decisions.FieldMappingOrigins!.GetValueOrDefault(
                    field, OrganizationImportResolutionOrigin.Administrator);
                mappings.Add(new(field, chosen,
                    chosen is null ? OrganizationImportResolutionStatus.Unresolved : OrganizationImportResolutionStatus.Resolved,
                    origin,
                    origin == OrganizationImportResolutionOrigin.SemanticSuggestion
                        ? "Accepted semantic suggestion"
                        : "Confirmed by an administrator",
                    chosen is null ? OrganizationImportMappingStatus.NeedsReview : OrganizationImportMappingStatus.Matched));
                continue;
            }

            var matches = labels.Where(label => FieldAliases[field].Any(alias => Normalize(alias) == label.Value))
                .Select(label => label.Key).ToList();
            var exactNativeIndex = native ? Array.FindIndex(NativeHeaders, header => FieldForNativeHeader(header) == field) : -1;
            mappings.Add(exactNativeIndex >= 0
                ? new(field, exactNativeIndex, OrganizationImportResolutionStatus.Resolved, OrganizationImportResolutionOrigin.Native, "Fusion template header", OrganizationImportMappingStatus.Matched)
                : matches.Count == 1
                    ? new(field, matches[0], OrganizationImportResolutionStatus.Resolved, OrganizationImportResolutionOrigin.Deterministic, "Matched source header", OrganizationImportMappingStatus.Matched)
                    : new(field, null, OrganizationImportResolutionStatus.Unresolved, OrganizationImportResolutionOrigin.Deterministic, "No unambiguous source header match", OrganizationImportMappingStatus.NeedsReview));
        }

        var businessIndex = mappings.FindIndex(mapping => mapping.Field == OrganizationImportFields.BusinessCode);
        if (decisions.IdentityStrategy != OrganizationImportGeneratedIdentityStrategy.DeterministicFromNameAndPath
            && mappings[businessIndex].ColumnIndex is null
            && TryInferBusinessCodeColumn(table, mappings, out var inferredBusinessCode, out var evidence))
            mappings[businessIndex] = new(OrganizationImportFields.BusinessCode, inferredBusinessCode,
                OrganizationImportResolutionStatus.Resolved, OrganizationImportResolutionOrigin.Deterministic, evidence, OrganizationImportMappingStatus.Matched);

        var parentIndex = mappings.FindIndex(mapping => mapping.Field == OrganizationImportFields.ParentBusinessCode);
        var codeIndex = mappings.Single(mapping => mapping.Field == OrganizationImportFields.BusinessCode).ColumnIndex;
        if (mappings[parentIndex].ColumnIndex is null && codeIndex is int sourceCodeColumn)
        {
            var sourceCodes = table.Rows.Select(row => sourceCodeColumn < row.Count ? Clean(row[sourceCodeColumn]) : null)
                .Where(value => value is not null).Select(value => NormalizeCode(value!)).ToHashSet(StringComparer.Ordinal);
            var used = mappings.Where(mapping => mapping.ColumnIndex is not null).Select(mapping => mapping.ColumnIndex!.Value).ToHashSet();
            var overlap = table.Columns.Where(column => !used.Contains(column.Index)).Select(column => new
            {
                column.Index,
                Values = table.Rows.Select(row => column.Index < row.Count ? Clean(row[column.Index]) : null).Where(value => value is not null).ToList(),
            }).Where(candidate => candidate.Values.Count > 0)
                .Select(candidate => new { candidate.Index, Matching = candidate.Values.Count(value => sourceCodes.Contains(NormalizeCode(value!))), candidate.Values.Count })
                .Where(candidate => candidate.Matching > 0 && candidate.Matching == candidate.Count).ToList();
            if (overlap.Count == 1)
                mappings[parentIndex] = new(OrganizationImportFields.ParentBusinessCode, overlap[0].Index,
                    OrganizationImportResolutionStatus.Resolved, OrganizationImportResolutionOrigin.Deterministic,
                    "Every populated value references an organization key", OrganizationImportMappingStatus.Matched);
        }

        var inferredTypeLevelColumns = table.Columns
            .Where(column => IsBuiltInType(column.SourceLabel)
                || (Clean(column.SourceLabel) is { } label && decisions.TypeMappings!.ContainsKey(label)))
            .Select(column => column.Index).ToList();
        var deterministicShape = native ? OrganizationImportShape.Native
            : inferredTypeLevelColumns.Count >= 2 ? OrganizationImportShape.LevelColumns
            : mappings.Any(mapping => mapping.Field == OrganizationImportFields.Name && mapping.ColumnIndex is not null)
              && mappings.Any(mapping => mapping.Field == OrganizationImportFields.ParentBusinessCode && mapping.ColumnIndex is not null)
                ? OrganizationImportShape.ParentReference
            : OrganizationImportShapeEvidence.HasParentReferenceStructure(table) ? OrganizationImportShape.ParentReference
            : OrganizationImportLevelEvidence.IsLevelColumnsTable(table) ? OrganizationImportShape.LevelColumns
            : OrganizationImportShape.Unresolved;
        var shape = decisions.Shape ?? deterministicShape;

        IReadOnlyList<int> levelColumns;
        IReadOnlyList<OrganizationImportIgnoredColumn> ignoredColumns;
        if (shape == OrganizationImportShape.LevelColumns)
            levelColumns = OrganizationImportLevelEvidence.SelectLevelColumns(table, out ignoredColumns);
        else
        {
            levelColumns = inferredTypeLevelColumns;
            var used = mappings.Where(mapping => mapping.ColumnIndex is not null).Select(mapping => mapping.ColumnIndex!.Value).ToHashSet();
            ignoredColumns = table.Columns.Where(column => !used.Contains(column.Index))
                .Select(column => new OrganizationImportIgnoredColumn(column.Index, column.SourceLabel ?? $"Column {column.Index + 1}", "Not used by the organization mapping plan"))
                .ToList();
        }

        var hasSourceBusinessCode = mappings.Single(mapping => mapping.Field == OrganizationImportFields.BusinessCode).ColumnIndex is not null;
        var identityStrategy = decisions.IdentityStrategy
            ?? (hasSourceBusinessCode ? OrganizationImportGeneratedIdentityStrategy.SourceBusinessCode
                : OrganizationImportGeneratedIdentityStrategy.DeterministicFromNameAndPath);
        var availableTypes = typeOptions ?? [];
        var typeDetails = BuildTypeMappings(table, shape, mappings, levelColumns, decisions, availableTypes, hasPermanentRoot);
        var identity = new OrganizationImportIdentityMapping(
            identityStrategy,
            mappings.Single(mapping => mapping.Field == OrganizationImportFields.BusinessCode).ColumnIndex,
            identityStrategy == OrganizationImportGeneratedIdentityStrategy.SourceBusinessCode && !hasSourceBusinessCode
                ? OrganizationImportMappingStatus.NeedsReview
                : OrganizationImportMappingStatus.Matched,
            decisions.IdentityStrategy is not null
                ? OrganizationImportResolutionOrigin.Administrator
                : hasSourceBusinessCode
                ? mappings.Single(mapping => mapping.Field == OrganizationImportFields.BusinessCode).Origin
                : OrganizationImportResolutionOrigin.Deterministic,
            identityStrategy == OrganizationImportGeneratedIdentityStrategy.SourceBusinessCode
                ? "Uses the stable identifier supplied by the source"
                : "Fusion generates stable codes from each name and hierarchy path");
        var plan = new OrganizationImportMappingPlan(
            shape,
            decisions.Shape is not null ? OrganizationImportResolutionStatus.Resolved
                : deterministicShape == OrganizationImportShape.Unresolved ? OrganizationImportResolutionStatus.Unresolved : OrganizationImportResolutionStatus.Resolved,
            decisions.Shape is not null ? decisions.ShapeDecisionOrigin ?? OrganizationImportResolutionOrigin.Administrator
                : native ? OrganizationImportResolutionOrigin.Native : OrganizationImportResolutionOrigin.Deterministic,
            mappings,
            decisions.TypeMappings!,
            levelColumns,
            ignoredColumns,
            identityStrategy,
            SourceFingerprint(session),
            decisions.TypeMappings!.Keys.ToDictionary(
                value => value,
                value => decisions.TypeMappingOrigins!.GetValueOrDefault(value, OrganizationImportResolutionOrigin.Administrator),
                StringComparer.OrdinalIgnoreCase),
            typeDetails,
            identity,
            session.DecisionRevision);
        return plan with { Digest = PlanDigest(plan) };
    }

    private static IReadOnlyList<OrganizationImportTypeMapping> BuildTypeMappings(
        OrganizationSourceTable table,
        OrganizationImportShape shape,
        IReadOnlyList<OrganizationImportFieldMapping> mappings,
        IReadOnlyList<int> levelColumns,
        OrganizationImportDecisions decisions,
        IReadOnlyList<OrganizationImportTypeOption> typeOptions,
        bool hasPermanentRoot)
    {
        var rawValues = new List<string>();
        if (shape == OrganizationImportShape.LevelColumns)
        {
            foreach (var column in levelColumns)
            {
                var label = Clean(table.Columns.Single(item => item.Index == column).SourceLabel);
                if (label is not null)
                    rawValues.AddRange(Enumerable.Repeat(label, table.Rows.Count(row => column < row.Count && Clean(row[column]) is not null)));
            }
        }
        else
        {
            var typeColumn = mappings.Single(mapping => mapping.Field == OrganizationImportFields.Type).ColumnIndex;
            if (typeColumn is int index)
                rawValues.AddRange(table.Rows.Select(row => index < row.Count ? Clean(row[index]) : null).Where(value => value is not null)!);
        }

        var depthLadder = shape == OrganizationImportShape.LevelColumns && !hasPermanentRoot
            ? OrganizationImportLevelEvidence.DepthTypeLadder(levelColumns.Count, hasPermanentRoot: false)
            : [];
        return rawValues.GroupBy(value => value, StringComparer.OrdinalIgnoreCase).Select(group =>
        {
            var raw = group.Key;
            if (decisions.TypeMappings!.TryGetValue(raw, out var selected)
                && typeOptions.FirstOrDefault(type => type.Id == selected) is { } chosen)
            {
                var origin = decisions.TypeMappingOrigins!.GetValueOrDefault(raw, OrganizationImportResolutionOrigin.Administrator);
                return new OrganizationImportTypeMapping(raw, chosen.Id, chosen.Name, group.Count(),
                    OrganizationImportMappingStatus.Matched, origin,
                    origin == OrganizationImportResolutionOrigin.SemanticSuggestion ? "Accepted semantic suggestion" : "Confirmed by an administrator");
            }

            var normalized = Normalize(TypeAlias(raw));
            var deterministic = typeOptions.Where(type => Normalize(type.Name) == normalized).ToList();
            if (deterministic.Count == 0 && shape == OrganizationImportShape.LevelColumns && depthLadder.Count > 0)
            {
                var columnPosition = Enumerable.Range(0, levelColumns.Count).FirstOrDefault(
                    position => string.Equals(Clean(table.Columns.Single(item => item.Index == levelColumns[position]).SourceLabel), raw, StringComparison.OrdinalIgnoreCase), -1);
                if (columnPosition >= 0)
                    deterministic = typeOptions.Where(type => Normalize(type.Name) == Normalize(depthLadder[columnPosition])).ToList();
            }
            return deterministic.Count == 1
                ? new OrganizationImportTypeMapping(raw, deterministic[0].Id, deterministic[0].Name, group.Count(),
                    OrganizationImportMappingStatus.Matched, OrganizationImportResolutionOrigin.Deterministic, "Matched organization type vocabulary")
                : new OrganizationImportTypeMapping(raw, null, null, group.Count(),
                    OrganizationImportMappingStatus.NeedsReview, OrganizationImportResolutionOrigin.Deterministic, "No unambiguous organization type match");
        }).OrderBy(mapping => mapping.SourceValue, StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static string TypeAlias(string value) => Normalize(value) switch
    {
        "org" or "company" => "Organization",
        "businessunit" or "bu" => "Business Unit",
        "div" => "Division",
        "dept" => "Department",
        _ => value,
    };

    private static string PlanDigest(OrganizationImportMappingPlan plan)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(plan with { Digest = null }))));

    private static bool TryInferBusinessCodeColumn(
        OrganizationSourceTable table,
        IReadOnlyList<OrganizationImportFieldMapping> mappings,
        out int columnIndex,
        out string evidence)
    {
        columnIndex = -1;
        evidence = string.Empty;
        var alreadyMapped = mappings.Where(mapping => mapping.ColumnIndex is not null)
            .Select(mapping => mapping.ColumnIndex!.Value).ToHashSet();
        var candidates = new List<(int Index, int ParentReferences)>();
        foreach (var column in table.Columns.Where(column => !alreadyMapped.Contains(column.Index)))
        {
            var values = table.Rows.Select(row => column.Index < row.Count ? Clean(row[column.Index]) : null)
                .Where(value => value is not null).Select(value => NormalizeCode(value!)).ToList();
            if (values.Count != table.Rows.Count || values.Distinct(StringComparer.Ordinal).Count() != values.Count) continue;
            var identifiers = values.ToHashSet(StringComparer.Ordinal);
            var parentReferences = table.Columns.Where(other => other.Index != column.Index).Count(other =>
            {
                var references = table.Rows.Select(row => other.Index < row.Count ? Clean(row[other.Index]) : null)
                    .Where(value => value is not null).Select(value => NormalizeCode(value!)).ToList();
                return references.Count > 0 && references.All(reference => identifiers.Contains(reference));
            });
            if (parentReferences > 0) candidates.Add((column.Index, parentReferences));
        }
        if (candidates.Count != 1) return false;
        columnIndex = candidates[0].Index;
        evidence = "Unique identifier values with a validated parent-reference column";
        return true;
    }

    private static string FieldForNativeHeader(string header) => header switch
    {
        "Fusion OrgUnit ID" => OrganizationImportFields.FusionOrgUnitId,
        "Business Code" => OrganizationImportFields.BusinessCode,
        "Name" => OrganizationImportFields.Name,
        "Type" => OrganizationImportFields.Type,
        _ => OrganizationImportFields.ParentBusinessCode,
    };

    private static bool IsBuiltInType(string? value)
        => OrganizationalUnitTypeCatalog.BuiltIns.Any(item => Normalize(item.Name) == Normalize(value));
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string Normalize(string? value) => new((value ?? string.Empty).Trim().ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
    private static string NormalizeCode(string value) => value.Trim().ToUpperInvariant();
    private static string SourceFingerprint(OrganizationImportSession session)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(
            $"{session.Source.Sha256}\n{session.Source.SelectedSheetName}\n{session.Source.SelectedRange}")));
}
