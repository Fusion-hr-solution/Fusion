using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public interface IOrganizationImportInterpreter
{
    Task<OrganizationImportReview> InterpretAsync(OrganizationImportSession session, CancellationToken cancellationToken);
}

/// <summary>
/// Deterministic, side-effect-free interpretation. A Fusion-generated Business Code
/// suggestion is proposal data only and MUST NOT be used as canonical identity evidence.
/// </summary>
public sealed class OrganizationImportInterpreter(CoreHRDbContext dbContext, ITenantContext tenantContext) : IOrganizationImportInterpreter
{
    private static readonly JsonSerializerOptions DigestJson = new(JsonSerializerDefaults.Web);
    private static readonly string[] NativeHeaders = ["Fusion OrgUnit ID", "Business Code", "Name", "Type", "Parent Business Code"];
    private static readonly Dictionary<string, string[]> FieldAliases = new(StringComparer.Ordinal)
    {
        [OrganizationImportFields.FusionOrgUnitId] = ["fusion orgunit id", "fusion org unit id", "orgunit id", "org unit id"],
        [OrganizationImportFields.BusinessCode] = ["business code", "unit code", "org code", "code"],
        [OrganizationImportFields.Name] = ["name", "unit name", "organization name", "org name"],
        [OrganizationImportFields.Type] = ["type", "unit type", "organization type", "org type"],
        [OrganizationImportFields.ParentBusinessCode] = ["parent business code", "parent code", "reports to code", "parent"],
    };
    private static readonly Dictionary<string, string> TypeAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["org"] = "Organization", ["company"] = "Organization",
        ["businessunit"] = "Business Unit", ["business unit"] = "Business Unit", ["bu"] = "Business Unit",
        ["division"] = "Division", ["div"] = "Division",
        ["department"] = "Department", ["dept"] = "Department",
        ["team"] = "Team", ["unit"] = "Unit",
    };

    public async Task<OrganizationImportReview> InterpretAsync(OrganizationImportSession session, CancellationToken cancellationToken)
    {
        if (session.Status != OrganizationImportStatus.Active)
            throw new InvalidOperationException("Only an active import can be interpreted.");
        var table = OrganizationImportJson.Deserialize(session.Source.SourceTableJson)
            ?? throw new OrganizationImportReviewException("SourceUnavailable", "The import source is no longer available.", StatusCodes.Status409Conflict);
        var decisions = (OrganizationImportJson.Deserialize<OrganizationImportDecisions>(session.DecisionsJson) ?? new OrganizationImportDecisions()).Normalize();
        var canonical = await LoadCanonicalAsync(session.EffectiveDate, cancellationToken);
        var inferred = InferShapeAndMappings(table, decisions);
        var issues = new List<IssueSeed>();
        inferred = ProtectAuthoritativeMappings(table, decisions, canonical, inferred, issues);
        if (inferred.Shape == OrganizationImportShape.Unresolved)
            issues.Add(Block("UnsupportedShape", "How is this file laid out?", "Fusion couldn't tell how this file is organized. Tell it whether each row lists its parent, or uses a column per level.", [], ["Choose source structure", "Replace source"]));
        if (inferred.Shape != OrganizationImportShape.LevelColumns)
            foreach (var mapping in inferred.Mappings.Where(mapping => mapping.Status == OrganizationImportResolutionStatus.Unresolved && mapping.Field == OrganizationImportFields.Name))
                issues.Add(Block("MissingNameMapping", "Which column has the names?", "Fusion needs to know which column holds the unit names before it can continue.", [], ["Map field", "Replace source"]));

        var nodes = inferred.Shape == OrganizationImportShape.LevelColumns
            ? BuildLevelNodes(table, inferred.LevelColumns, canonical, decisions, issues)
            : BuildRowNodes(table, inferred.Mappings, canonical, decisions, issues);
        nodes.RemoveAll(node => decisions.ExcludedNodeIds!.Contains(node.Id, StringComparer.Ordinal));

        ResolveTypes(nodes, canonical, decisions, issues);
        ResolveParents(nodes, canonical, decisions, issues);
        ResolveIdentityAndClassify(nodes, canonical, decisions, issues);
        ValidateExistingParentEvidence(nodes, canonical, issues);
        ApplyFreshRoot(nodes, canonical, decisions, issues);
        GenerateAndValidateCreateCodes(nodes, canonical, issues);
        var result = BuildAndValidateResult(nodes, canonical, session.EffectiveDate, issues);
        var grouped = GroupIssues(issues);
        var digest = CreateSemanticDigest(session.EffectiveDate, nodes, result, grouped);

        return new OrganizationImportReview(
            inferred.Shape, inferred.ShapeStatus, inferred.ShapeOrigin, inferred.Mappings,
            canonical.Types.Select(type => new OrganizationImportTypeOption(type.Id, type.Name)).ToList(),
            nodes.Select(ToReviewNode).ToList(), result, grouped,
            nodes.Count(node => node.Classification == OrganizationImportNodeClassification.Unchanged),
            nodes.Count(node => node.Classification == OrganizationImportNodeClassification.Create),
            grouped.All(issue => issue.Severity != OrganizationImportIssueSeverity.Blocker),
            digest, canonical.ObservationDigest, session.DecisionRevision,
            session.DecisionsUpdatedAt, session.DecisionsUpdatedByDisplayName);
    }

    private async Task<CanonicalSnapshot> LoadCanonicalAsync(DateOnly effectiveDate, CancellationToken cancellationToken)
    {
        var units = await dbContext.OrgUnits.AsNoTracking().OrderBy(unit => unit.Id).ToListAsync(cancellationToken);
        var states = await dbContext.OrgUnitEffectiveStates.AsNoTracking()
            .Include(state => state.OrganizationalUnitType)
            .Where(state => state.EffectiveFrom <= effectiveDate && (state.EffectiveTo == null || state.EffectiveTo > effectiveDate))
            .OrderBy(state => state.OrgUnitId).ToListAsync(cancellationToken);
        var reservations = await dbContext.OrgUnitCodeReservations.AsNoTracking().OrderBy(item => item.NormalizedCode).ToListAsync(cancellationToken);
        var types = await dbContext.OrganizationalUnitTypes.AsNoTracking()
            .Where(type => type.IsBuiltIn || type.TenantId == tenantContext.TenantId)
            .OrderBy(type => type.DisplayName)
            .Select(type => new CanonicalType(type.Id, type.DisplayName)).ToListAsync(cancellationToken);
        var stateById = states.ToDictionary(state => state.OrgUnitId);
        var candidates = units.Select(unit =>
        {
            stateById.TryGetValue(unit.Id, out var state);
            return new CanonicalUnit(unit.Id, unit.Code, unit.Version, unit.IsRoot, state?.Name, state?.OrganizationalUnitTypeId,
                state?.OrganizationalUnitType.DisplayName, state?.ParentOrgUnitId, state?.LifecycleState == OrgUnitLifecycleState.Active);
        }).ToList();
        var observation = Hash(JsonSerializer.Serialize(new
        {
            effectiveDate,
            units = candidates.Select(unit => new { unit.Id, unit.Code, unit.Version, unit.IsRoot, unit.Name, unit.TypeId, unit.ParentId, unit.IsActive }),
            reservations = reservations.Select(item => new { item.NormalizedCode, item.OrgUnitId }),
            types,
        }, DigestJson));
        return new CanonicalSnapshot(candidates, reservations.Select(item => new Reservation(item.NormalizedCode, item.OrgUnitId)).ToList(), types, observation);
    }

    private static Inference InferShapeAndMappings(OrganizationSourceTable table, OrganizationImportDecisions decisions)
    {
        var labels = table.Columns.ToDictionary(column => column.Index, column => Normalize(column.SourceLabel));
        var native = table.Columns.Count == NativeHeaders.Length
            && NativeHeaders.Select(Normalize).SequenceEqual(table.Columns.Select(column => Normalize(column.SourceLabel)));
        var mappings = new List<OrganizationImportFieldMapping>();
        foreach (var field in FieldAliases.Keys)
        {
            if (decisions.FieldMappings!.TryGetValue(field, out var chosen))
            {
                mappings.Add(new(field, chosen, chosen is null ? OrganizationImportResolutionStatus.Unresolved : OrganizationImportResolutionStatus.Resolved, OrganizationImportResolutionOrigin.Administrator));
                continue;
            }
            var matches = labels.Where(label => FieldAliases[field].Any(alias => Normalize(alias) == label.Value)).Select(label => label.Key).ToList();
            var exactNativeIndex = native ? Array.FindIndex(NativeHeaders, header => FieldForNativeHeader(header) == field) : -1;
            mappings.Add(exactNativeIndex >= 0
                ? new(field, exactNativeIndex, OrganizationImportResolutionStatus.Resolved, OrganizationImportResolutionOrigin.Native)
                : matches.Count == 1
                    ? new(field, matches[0], OrganizationImportResolutionStatus.Resolved, OrganizationImportResolutionOrigin.Deterministic)
                    : new(field, null, OrganizationImportResolutionStatus.Unresolved, OrganizationImportResolutionOrigin.Deterministic));
        }

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
                    OrganizationImportResolutionStatus.Resolved, OrganizationImportResolutionOrigin.Deterministic);
        }

        var inferredTypeLevelColumns = table.Columns
            .Where(column => TryBuiltInType(column.SourceLabel, out _)
                || (Clean(column.SourceLabel) is { } label && decisions.TypeMappings!.ContainsKey(label)))
            .Select(column => column.Index).ToList();
        var deterministicShape = native ? OrganizationImportShape.Native
            : inferredTypeLevelColumns.Count >= 2 ? OrganizationImportShape.LevelColumns
            : mappings.Any(mapping => mapping.Field == OrganizationImportFields.Name && mapping.ColumnIndex is not null)
                && mappings.Any(mapping => mapping.Field == OrganizationImportFields.ParentBusinessCode && mapping.ColumnIndex is not null)
                ? OrganizationImportShape.ParentReference
            // A self-referential foreign key (one column's values reference another
            // identifier column) is a parent-reference table even before the field
            // meanings are known. Establish the shape deterministically and leave the
            // column meanings to semantic interpretation.
            : OrganizationImportShapeEvidence.HasParentReferenceStructure(table)
                ? OrganizationImportShape.ParentReference
                : OrganizationImportShape.Unresolved;
        var shape = decisions.Shape ?? deterministicShape;
        // Once an administrator selects the level-column shape, every source column is part of that
        // hierarchy. Unmapped columns must remain visible as unresolved work instead of disappearing.
        var typeLevelColumns = shape == OrganizationImportShape.LevelColumns
            ? table.Columns.Select(column => column.Index).ToList()
            : inferredTypeLevelColumns;
        return new Inference(shape,
            decisions.Shape is not null ? OrganizationImportResolutionStatus.Resolved : deterministicShape == OrganizationImportShape.Unresolved ? OrganizationImportResolutionStatus.Unresolved : OrganizationImportResolutionStatus.Resolved,
            decisions.Shape is not null ? OrganizationImportResolutionOrigin.Administrator : native ? OrganizationImportResolutionOrigin.Native : OrganizationImportResolutionOrigin.Deterministic,
            mappings, typeLevelColumns);
    }

    private static Inference ProtectAuthoritativeMappings(
        OrganizationSourceTable table,
        OrganizationImportDecisions decisions,
        CanonicalSnapshot canonical,
        Inference inference,
        List<IssueSeed> issues)
    {
        var mappings = inference.Mappings.ToList();
        foreach (var field in new[] { OrganizationImportFields.FusionOrgUnitId, OrganizationImportFields.BusinessCode })
        {
            if (!decisions.FieldMappings!.ContainsKey(field)) continue;
            var aliases = FieldAliases[field];
            var natural = table.Columns.Where(column => aliases.Any(alias => Normalize(alias) == Normalize(column.SourceLabel))).Select(column => column.Index).ToList();
            if (natural.Count != 1) continue;
            var naturalColumn = natural[0];
            var containsValidIdentity = table.Rows.Select(row => naturalColumn < row.Count ? Clean(row[naturalColumn]) : null).Any(value =>
                value is not null && (field == OrganizationImportFields.FusionOrgUnitId
                    ? Guid.TryParse(value, out var id) && canonical.ById.ContainsKey(id)
                    : canonical.ByCurrentCode.ContainsKey(NormalizeCode(value)) || canonical.ByReservedCode.ContainsKey(NormalizeCode(value))));
            if (!containsValidIdentity) continue;
            var index = mappings.FindIndex(mapping => mapping.Field == field);
            if (mappings[index].ColumnIndex == naturalColumn) continue;
            mappings[index] = new(field, naturalColumn, OrganizationImportResolutionStatus.Resolved, OrganizationImportResolutionOrigin.Deterministic);
            issues.Add(Info("AuthoritativeIdentityRetained", "Kept the matching unit",
                "A value in your file matches an existing unit, so it's kept as that unit instead of a new one.", [], ["Replace source", "Keep canonical meaning"]));
        }
        return inference with { Mappings = mappings };
    }

    private static List<MutableNode> BuildRowNodes(OrganizationSourceTable table, IReadOnlyList<OrganizationImportFieldMapping> mappings,
        CanonicalSnapshot canonical, OrganizationImportDecisions decisions, List<IssueSeed> issues)
    {
        int? Column(string field) => mappings.Single(mapping => mapping.Field == field).ColumnIndex;
        var idColumn = Column(OrganizationImportFields.FusionOrgUnitId);
        var codeColumn = Column(OrganizationImportFields.BusinessCode);
        var nameColumn = Column(OrganizationImportFields.Name);
        var typeColumn = Column(OrganizationImportFields.Type);
        var parentColumn = Column(OrganizationImportFields.ParentBusinessCode);
        var nodes = new List<MutableNode>();
        for (var index = 0; index < table.Rows.Count; index++)
        {
            var row = table.Rows[index];
            string? At(int? column) => column is int value && value < row.Count ? Clean(row[value]) : null;
            var name = At(nameColumn);
            if (name is null) continue;
            var id = $"row:{index + 1}";
            var correction = decisions.NodeCorrections!.GetValueOrDefault(id);
            nodes.Add(new MutableNode(id, correction?.Name ?? name, correction?.BusinessCode ?? At(codeColumn), false,
                At(typeColumn), correction?.TypeId, At(parentColumn), correction?.ParentNodeId, correction?.ParentCanonicalId,
                At(idColumn), false, Cells(index, row, [idColumn, codeColumn, nameColumn, typeColumn, parentColumn])));
        }
        if (nodes.Count == 0)
            issues.Add(Block("NoProposalNodes", "No units in this file", "Fusion didn't find any unit names in this file. Check the file, or point Fusion at the name column.", [], ["Correct field mapping", "Replace source"]));
        return nodes;
    }

    private static List<MutableNode> BuildLevelNodes(OrganizationSourceTable table, IReadOnlyList<int> levelColumns,
        CanonicalSnapshot canonical, OrganizationImportDecisions decisions, List<IssueSeed> issues)
    {
        if (levelColumns.Count < 2)
        {
            issues.Add(Block("LevelColumnsUnresolved", "Not enough level columns", "This layout needs at least two columns, one per level (for example Division, then Department).", [], ["Choose source structure", "Replace source"]));
            return [];
        }
        var nodes = new List<MutableNode>();
        var byPath = new Dictionary<string, MutableNode>(StringComparer.OrdinalIgnoreCase);
        for (var rowIndex = 0; rowIndex < table.Rows.Count; rowIndex++)
        {
            var row = table.Rows[rowIndex];
            var pathParts = new List<string>();
            string? parentId = null;
            foreach (var column in levelColumns)
            {
                var value = column < row.Count ? Clean(row[column]) : null;
                if (value is null) break;
                pathParts.Add(value);
                var path = string.Join('\u001f', pathParts.Select(Normalize));
                if (!byPath.TryGetValue(path, out var node))
                {
                    var id = "path:" + Hash(path)[..16];
                    var correction = decisions.NodeCorrections!.GetValueOrDefault(id);
                    var rawLevelType = Clean(table.Columns[column].SourceLabel);
                    TryBuiltInType(rawLevelType, out var typeName);
                    Guid? mappedTypeId = null;
                    if (rawLevelType is not null
                        && decisions.TypeMappings!.TryGetValue(rawLevelType, out var selectedTypeId)
                        && canonical.Types.Any(type => type.Id == selectedTypeId))
                    {
                        mappedTypeId = selectedTypeId;
                        typeName = canonical.Types.Single(type => type.Id == selectedTypeId).Name;
                    }
                    node = new MutableNode(id, correction?.Name ?? value, correction?.BusinessCode, false,
                        rawLevelType ?? typeName, correction?.TypeId ?? mappedTypeId, null, correction?.ParentNodeId ?? parentId, correction?.ParentCanonicalId,
                        null, false, []);
                    node.TypeName = correction?.TypeId is Guid correctedTypeId
                        ? canonical.Types.SingleOrDefault(type => type.Id == correctedTypeId)?.Name
                        : typeName;
                    byPath.Add(path, node);
                    nodes.Add(node);
                }
                node.SourceCells.Add(new OrganizationImportSourceCell(rowIndex + 2, column, value));
                parentId = node.Id;
            }
        }
        return nodes;
    }

    private static void ResolveTypes(List<MutableNode> nodes, CanonicalSnapshot canonical, OrganizationImportDecisions decisions, List<IssueSeed> issues)
    {
        foreach (var node in nodes)
        {
            if (node.TypeId is Guid corrected && canonical.Types.Any(type => type.Id == corrected))
            {
                node.TypeName = canonical.Types.Single(type => type.Id == corrected).Name;
                continue;
            }
            var raw = Clean(node.RawType);
            if (raw is not null && decisions.TypeMappings!.TryGetValue(raw, out var mapped) && canonical.Types.Any(type => type.Id == mapped))
            {
                node.TypeId = mapped; node.TypeName = canonical.Types.Single(type => type.Id == mapped).Name; continue;
            }
            var normalized = raw is null ? null : Normalize(TypeAliases.GetValueOrDefault(raw, raw));
            var candidates = normalized is null ? [] : canonical.Types.Where(type => Normalize(type.Name) == normalized).ToList();
            if (candidates.Count == 1) { node.TypeId = candidates[0].Id; node.TypeName = candidates[0].Name; }
        }
        foreach (var group in nodes.Where(node => node.TypeId is null).GroupBy(node => Clean(node.RawType) ?? "(blank)", StringComparer.OrdinalIgnoreCase))
            issues.Add(Block("UnknownType", "Unknown unit type", $"Your file uses the type '{group.Key}', which isn't one of your organization types. Pick the type it should map to.", group.ToList(), ["Map type", "Manage Organization types", "Replace source"]));
    }

    private static void ResolveParents(List<MutableNode> nodes, CanonicalSnapshot canonical, OrganizationImportDecisions decisions, List<IssueSeed> issues)
    {
        var sourceByCode = nodes.Where(node => node.SourceBusinessCode is not null)
            .GroupBy(node => NormalizeCode(node.SourceBusinessCode!)).Where(group => group.Count() == 1).ToDictionary(group => group.Key, group => group.Single(), StringComparer.Ordinal);
        var sourceByName = nodes.GroupBy(node => Normalize(node.Name)).Where(group => group.Count() == 1).ToDictionary(group => group.Key, group => group.Single(), StringComparer.Ordinal);
        foreach (var node in nodes)
        {
            if (node.ParentNodeId is not null || node.ParentCanonicalId is not null || node.RawParent is null) continue;
            var normalized = NormalizeCode(node.RawParent);
            if (sourceByCode.TryGetValue(normalized, out var sourceParent)) node.ParentNodeId = sourceParent.Id;
            else if (canonical.ByCurrentCode.TryGetValue(normalized, out var current)) node.ParentCanonicalId = current.Id;
            else if (canonical.ByReservedCode.TryGetValue(normalized, out var reserved)) node.ParentCanonicalId = reserved.Id;
            else if (sourceByName.TryGetValue(Normalize(node.RawParent), out var named)) node.ParentNodeId = named.Id;
            else issues.Add(Block("ParentUnresolved", "Parent not found", $"Fusion couldn't find a unit called '{node.RawParent}' for this unit's parent. Choose where it belongs.", [node], ["Choose parent", "Correct proposed unit", "Replace source"]));
        }
    }

    private static void ResolveIdentityAndClassify(List<MutableNode> nodes, CanonicalSnapshot canonical, OrganizationImportDecisions decisions, List<IssueSeed> issues)
    {
        foreach (var node in nodes)
        {
            var evidence = new List<(string Identifier, string Supplied, CanonicalUnit Unit)>();
            var suppliedId = Guid.TryParse(node.SourceFusionId, out var parsedId) ? parsedId : (Guid?)null;
            if (suppliedId is Guid id)
            {
                if (!canonical.ById.TryGetValue(id, out var byId))
                    issues.Add(Block("FusionIdUnavailable", "Unit ID not found", "The Fusion ID in this row doesn't match any unit in your organization. Correct it in the file, or clear it to add a new unit.", [node], ["Correct field mapping", "Replace source"]));
                else evidence.Add((OrganizationImportFields.FusionOrgUnitId, node.SourceFusionId!, byId));
            }
            if (node.SourceBusinessCode is not null)
            {
                var code = NormalizeCode(node.SourceBusinessCode);
                if (canonical.ByCurrentCode.TryGetValue(code, out var current)) evidence.Add((OrganizationImportFields.BusinessCode, node.SourceBusinessCode, current));
                else if (canonical.ByReservedCode.TryGetValue(code, out var former)) evidence.Add((OrganizationImportFields.BusinessCode, node.SourceBusinessCode, former));
            }
            var authoritative = evidence.Select(item => item.Unit).DistinctBy(unit => unit.Id).ToList();
            if (authoritative.Count > 1)
            {
                node.Classification = OrganizationImportNodeClassification.Conflict;
                node.IdentityEvidence = evidence
                    .DistinctBy(item => (item.Identifier, item.Unit.Id))
                    .Select(item => new OrganizationImportIdentityEvidence(item.Identifier, item.Supplied, item.Unit.Id, item.Unit.Name ?? item.Unit.Code, item.Unit.Code))
                    .ToList();
                issues.Add(Block("StrongIdentityContradiction", "This row points to two units", "The ID and the business code in this row belong to two different existing units, so Fusion can't tell which one you mean. Fix the file so they match one unit.", [node], ["Correct field mapping", "Replace source"]));
                continue;
            }
            if (authoritative.Count == 1)
            {
                BindExisting(node, authoritative[0], canonical, decisions, issues, authoritative: true);
                continue;
            }
            if (decisions.AcceptedExistingMatches!.TryGetValue(node.Id, out var acceptedId) && canonical.ById.TryGetValue(acceptedId, out var accepted))
            {
                BindExisting(node, accepted, canonical, decisions, issues, authoritative: false);
                continue;
            }
            node.DescriptiveCandidates = canonical.ActiveUnits.Where(unit => Normalize(unit.Name) == Normalize(node.Name)).Select(ToCandidate).ToList();
            node.Classification = OrganizationImportNodeClassification.Create;
            if (node.DescriptiveCandidates.Count > 0)
                issues.Add(Warn("DescriptiveCandidate", "Might already exist", "A unit with this name already exists. Tell Fusion whether this is that same unit or a new one.", [node], ["Use existing unit", "Keep as new"]));
        }
    }

    private static void BindExisting(MutableNode node, CanonicalUnit unit, CanonicalSnapshot canonical, OrganizationImportDecisions decisions,
        List<IssueSeed> issues, bool authoritative)
    {
        node.CanonicalId = unit.Id;
        node.DescriptiveCandidates = [];
        if (!unit.IsActive || unit.Name is null || unit.TypeId is null)
        {
            node.Classification = OrganizationImportNodeClassification.Conflict;
            issues.Add(Block("ExistingUnavailableAsOfDate", "Unit isn't active on that date", "The matching unit doesn't exist on the effective date you picked. Choose a different date, or check the file.", [node], ["Change Effective date", "Replace source"]));
            return;
        }
        var proposedParent = node.ParentCanonicalId;
        var parentMatches = node.ParentNodeId is null ? proposedParent == unit.ParentId : true;
        var matches = string.Equals(node.Name.Trim(), unit.Name, StringComparison.Ordinal)
            && node.TypeId == unit.TypeId && parentMatches;
        if (matches || decisions.KeepCanonicalNodeIds!.Contains(node.Id, StringComparer.Ordinal))
        {
            node.Classification = OrganizationImportNodeClassification.Unchanged;
            node.Name = unit.Name;
            node.SourceBusinessCode = unit.Code;
            node.TypeId = unit.TypeId;
            node.TypeName = unit.TypeName;
            node.ParentCanonicalId = unit.ParentId;
            node.ParentNodeId = null;
            return;
        }
        node.Classification = OrganizationImportNodeClassification.Conflict;
        issues.Add(Block("UnsupportedExistingDifference", "Unit already exists",
            authoritative
                ? "This unit already exists in your organization and the file describes it differently. Import can't change a unit that's already there — keep the current version or fix the file."
                : "The existing unit you matched differs from the file. Import can't change a unit that's already there — keep the current version or fix the file.",
            [node], ["Keep canonical meaning", "Correct field mapping", "Replace source", "Manage Organization"]));
    }

    private static void ApplyFreshRoot(List<MutableNode> nodes, CanonicalSnapshot canonical, OrganizationImportDecisions decisions, List<IssueSeed> issues)
    {
        var permanentRoot = canonical.Units.SingleOrDefault(unit => unit.IsRoot);
        if (permanentRoot is not null)
        {
            if (decisions.IntroducedRoot is not null)
                issues.Add(Block("FreshRootUnavailable", "Organization root already exists", "You added a top-level organization, but this tenant already has one. Remove the one you added.", [], ["Remove proposed root"]));
            foreach (var node in nodes.Where(node => node.Classification == OrganizationImportNodeClassification.Create && node.ParentNodeId is null && node.ParentCanonicalId is null))
                node.ParentCanonicalId = permanentRoot.IsActive ? permanentRoot.Id : null;
            foreach (var node in nodes.Where(node => node.Classification == OrganizationImportNodeClassification.Create && node.TypeId == OrganizationalUnitTypeCatalog.OrganizationId))
                issues.Add(Block("SecondOrganizationRoot", "Only one organization root allowed", "This unit is set as a top-level Organization, but your organization already has one. Give it a parent or a different type, or leave it out.", [node], ["Correct proposed unit", "Exclude proposed unit", "Replace source"]));
            if (!permanentRoot.IsActive)
                issues.Add(Block("PermanentRootUnavailableAsOfDate", "Organization root isn't active on that date", "The top of your organization doesn't exist on the effective date you picked. Choose a later date.", [], ["Change Effective date"]));
            return;
        }

        var top = nodes.Where(node => node.Classification != OrganizationImportNodeClassification.Conflict && node.ParentNodeId is null && node.ParentCanonicalId is null).ToList();
        // Root meaning is structural: a single parentless source row with the rest of the
        // hierarchy connected beneath it (every other node resolved a parent, so nothing else
        // surfaces as top) is unambiguously the organization root. Promote it deterministically,
        // regardless of its source type — mapping unfamiliar type vocabulary such as "Groupe" is
        // a separate, AI-assisted concern. Only genuinely ambiguous structure (multiple parentless
        // or disconnected tops) falls through to require an administrator-introduced root.
        if (top.Count == 1) { top[0].IsProposalRoot = true; return; }
        if (decisions.IntroducedRoot is null)
        {
            issues.Add(Block("FreshRootRequired", "Add the top of your organization", "This file has more than one top-level unit. Add one organization to sit above them all.", top, ["Introduce Organization root", "Replace source"]));
            return;
        }
        var root = new MutableNode("root:introduced", decisions.IntroducedRoot.Name, decisions.IntroducedRoot.BusinessCode, false,
            "Organization", OrganizationalUnitTypeCatalog.OrganizationId, null, null, null, null, true, []);
        root.Classification = OrganizationImportNodeClassification.Create;
        nodes.Insert(0, root);
        foreach (var node in top) node.ParentNodeId = root.Id;
    }

    private static void ValidateExistingParentEvidence(List<MutableNode> nodes, CanonicalSnapshot canonical, List<IssueSeed> issues)
    {
        var byNodeId = nodes.ToDictionary(node => node.Id, StringComparer.Ordinal);
        foreach (var node in nodes.Where(node => node.CanonicalId is not null && node.ParentNodeId is not null))
        {
            if (!canonical.ById.TryGetValue(node.CanonicalId!.Value, out var existing)
                || !byNodeId.TryGetValue(node.ParentNodeId!, out var proposedParent)
                || proposedParent.CanonicalId == existing.ParentId)
                continue;
            node.Classification = OrganizationImportNodeClassification.Conflict;
            issues.Add(Block("UnsupportedExistingDifference", "Unit already exists",
                "This unit already exists and the file puts it under a different parent. Import can't move a unit that's already there — keep it where it is, or fix the file.", [node],
                ["Keep canonical meaning", "Replace source", "Manage Organization"]));
        }
    }

    private static void GenerateAndValidateCreateCodes(List<MutableNode> nodes, CanonicalSnapshot canonical, List<IssueSeed> issues)
    {
        foreach (var node in nodes.Where(node => node.Classification == OrganizationImportNodeClassification.Create && string.IsNullOrWhiteSpace(node.SourceBusinessCode)))
        {
            node.SourceBusinessCode = SuggestCode(node.Name);
            node.BusinessCodeGenerated = true;
        }
        var create = nodes.Where(node => node.Classification == OrganizationImportNodeClassification.Create).ToList();
        foreach (var node in create)
        {
            var code = node.SourceBusinessCode is null ? string.Empty : NormalizeCode(node.SourceBusinessCode);
            node.SourceBusinessCode = code;
            if (code.Length is < 1 or > 50 || code.Any(character => !char.IsLetterOrDigit(character) && character is not '-' and not '_'))
                issues.Add(Block("InvalidBusinessCode", "Fix the business code", "A business code can only use letters, numbers, hyphens, or underscores (up to 50 characters).", [node], ["Correct proposed unit"]));
            if (canonical.ByCurrentCode.ContainsKey(code) || canonical.ByReservedCode.ContainsKey(code))
                issues.Add(Block("BusinessCodeUnavailable", "Business code is taken", $"The business code '{code}' is already used by another unit. Choose a different one.", [node], ["Correct proposed unit"]));
        }
        foreach (var duplicate in create.Where(node => node.SourceBusinessCode is not null).GroupBy(node => node.SourceBusinessCode!, StringComparer.Ordinal).Where(group => group.Count() > 1))
            issues.Add(Block("DuplicateProposalCode", "Business code used twice", $"The business code '{duplicate.Key}' is used by more than one new unit. Give each one a unique code.", duplicate.ToList(), ["Correct proposed unit"]));
    }

    private static IReadOnlyList<OrganizationImportResultNode> BuildAndValidateResult(List<MutableNode> nodes, CanonicalSnapshot canonical,
        DateOnly effectiveDate, List<IssueSeed> issues)
    {
        var proposalById = nodes.ToDictionary(node => node.Id, StringComparer.Ordinal);
        foreach (var node in nodes.Where(node => node.Classification == OrganizationImportNodeClassification.Create && node.ParentNodeId is not null))
        {
            if (!proposalById.TryGetValue(node.ParentNodeId!, out var proposedParent)
                || proposedParent.Classification != OrganizationImportNodeClassification.Unchanged
                || proposedParent.CanonicalId is not Guid canonicalParentId)
                continue;

            node.ParentNodeId = null;
            node.ParentCanonicalId = canonicalParentId;
        }

        var result = canonical.ActiveUnits.Select(unit => new OrganizationImportResultNode(
            "canonical:" + unit.Id, unit.Id, unit.Name!, unit.Code, unit.TypeName!, unit.ParentId is Guid parent ? "canonical:" + parent : null, false, unit.IsRoot)).ToList();
        foreach (var node in nodes.Where(node => node.Classification == OrganizationImportNodeClassification.Create))
        {
            var parent = node.ParentNodeId ?? (node.ParentCanonicalId is Guid canonicalParent ? "canonical:" + canonicalParent : null);
            result.Add(new(node.Id, null, node.Name, node.SourceBusinessCode ?? string.Empty, node.TypeName ?? "Unresolved", parent, true, node.IsProposalRoot));
        }
        foreach (var node in nodes.Where(node => node.Classification == OrganizationImportNodeClassification.Create))
        {
            if (node.ParentNodeId is not null && nodes.All(parent => parent.Id != node.ParentNodeId || parent.Classification != OrganizationImportNodeClassification.Create))
                issues.Add(Block("ParentUnavailable", "Parent isn't available", "The parent you picked is no longer part of this import. Choose another parent.", [node], ["Choose parent"]));
            if (node.ParentCanonicalId is Guid parentId && canonical.ActiveUnits.All(parent => parent.Id != parentId))
                issues.Add(Block("ParentUnavailable", "Parent isn't available on that date", "The parent you picked isn't active on the effective date. Choose another parent, or change the date.", [node], ["Choose parent", "Change Effective date"]));
        }
        var byId = result.ToDictionary(node => node.Id);
        foreach (var node in result)
        {
            var seen = new HashSet<string>(StringComparer.Ordinal);
            var cursor = node;
            while (cursor.ParentId is not null && byId.TryGetValue(cursor.ParentId, out var parent))
            {
                if (!seen.Add(cursor.Id)) { issues.Add(Block("HierarchyCycle", "Units can't loop", "Some units are set as each other's parent. Fix the parents so the structure forms a tree.", [], ["Choose parent"])); break; }
                cursor = parent;
            }
        }
        var roots = result.Where(node => node.ParentId is null).ToList();
        if (result.Count > 0 && roots.Count != 1)
            issues.Add(Block("RootCount", "One top-level organization needed", "This file produces more than one top-level unit. They all need to sit under a single organization.", [], ["Introduce Organization root", "Choose parent"]));
        if (roots.Count == 1 && !roots[0].IsRoot)
            issues.Add(Block("RootType", "The top unit must be an Organization", "The unit at the very top needs to be the Organization type.", [], ["Introduce Organization root", "Correct proposed unit"]));
        return result.OrderBy(node => node.ParentId).ThenBy(node => node.Name, StringComparer.Ordinal).ToList();
    }

    private static IReadOnlyList<OrganizationImportIssue> GroupIssues(List<IssueSeed> seeds)
        => seeds.GroupBy(seed => new { seed.Code, seed.Severity, seed.Title, seed.Message })
            .Select(group => new OrganizationImportIssue(group.Key.Code, group.Key.Severity, group.Key.Title, group.Key.Message,
                group.SelectMany(seed => seed.Nodes).Select(node => node.Id).Distinct().Count(),
                group.SelectMany(seed => seed.Nodes).Select(node => node.Id).Distinct().ToList(),
                group.SelectMany(seed => seed.Nodes).SelectMany(node => node.SourceCells).Distinct().ToList(),
                group.SelectMany(seed => seed.RecoveryActions).Distinct().ToList()))
            .OrderBy(issue => issue.Severity).ThenBy(issue => issue.Code, StringComparer.Ordinal).ToList();

    private static string CreateSemanticDigest(DateOnly effectiveDate, List<MutableNode> nodes,
        IReadOnlyList<OrganizationImportResultNode> result, IReadOnlyList<OrganizationImportIssue> issues)
        => Hash(JsonSerializer.Serialize(new
        {
            effectiveDate,
            nodes = nodes.OrderBy(node => node.Id).Select(node => new { node.Id, node.CanonicalId, node.Classification, node.Name, node.SourceBusinessCode, node.TypeId, node.ParentNodeId, node.ParentCanonicalId, node.IsProposalRoot }),
            result = result.OrderBy(node => node.Id),
            issues = issues.Select(issue => new { issue.Code, issue.Severity, issue.NodeIds }),
        }, DigestJson));

    private static OrganizationImportReviewNode ToReviewNode(MutableNode node) => new(node.Id, node.Name, node.SourceBusinessCode,
        node.BusinessCodeGenerated, node.RawType, node.TypeId, node.TypeName, node.ParentNodeId, node.ParentCanonicalId, node.RawParent, node.CanonicalId,
        node.Classification, node.IsProposalRoot, node.DescriptiveCandidates, node.SourceCells, node.IdentityEvidence);
    private static OrganizationImportCandidate ToCandidate(CanonicalUnit unit) => new(unit.Id, unit.Code, unit.Name!, unit.TypeId!.Value, unit.TypeName!, unit.ParentId);
    private static List<OrganizationImportSourceCell> Cells(int rowIndex, IReadOnlyList<string?> row, IEnumerable<int?> columns)
        => columns.Where(column => column is not null).Select(column => column!.Value).Distinct().Where(column => column < row.Count)
            .Select(column => new OrganizationImportSourceCell(rowIndex + 2, column, row[column])).ToList();
    private static string FieldForNativeHeader(string header) => header switch
    {
        "Fusion OrgUnit ID" => OrganizationImportFields.FusionOrgUnitId, "Business Code" => OrganizationImportFields.BusinessCode,
        "Name" => OrganizationImportFields.Name, "Type" => OrganizationImportFields.Type, _ => OrganizationImportFields.ParentBusinessCode,
    };
    private static bool TryBuiltInType(string? value, out string typeName)
    {
        var normalized = Normalize(value);
        var match = OrganizationalUnitTypeCatalog.BuiltIns.FirstOrDefault(item => Normalize(item.Name) == normalized);
        typeName = match.Name ?? string.Empty;
        return match != default;
    }
    private static string SuggestCode(string name)
    {
        var words = Regex.Matches(name.ToUpperInvariant(), "[A-Z0-9]+", RegexOptions.CultureInvariant)
            .Select(match => match.Value).ToList();
        return words.Count switch { 0 => "UNIT", 1 => words[0][..Math.Min(8, words[0].Length)], _ => new string(words.Select(word => word[0]).Take(8).ToArray()) };
    }
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string Normalize(string? value) => new((value ?? string.Empty).Trim().ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
    private static string NormalizeCode(string value) => value.Trim().ToUpperInvariant();
    private static string Hash(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private static IssueSeed Block(string code, string title, string message, IReadOnlyList<MutableNode> nodes, IReadOnlyList<string> recovery)
        => new(code, OrganizationImportIssueSeverity.Blocker, title, message, nodes, recovery);
    private static IssueSeed Warn(string code, string title, string message, IReadOnlyList<MutableNode> nodes, IReadOnlyList<string> recovery)
        => new(code, OrganizationImportIssueSeverity.Warning, title, message, nodes, recovery);
    private static IssueSeed Info(string code, string title, string message, IReadOnlyList<MutableNode> nodes, IReadOnlyList<string> recovery)
        => new(code, OrganizationImportIssueSeverity.Information, title, message, nodes, recovery);

    private sealed record Inference(OrganizationImportShape Shape, OrganizationImportResolutionStatus ShapeStatus,
        OrganizationImportResolutionOrigin ShapeOrigin, IReadOnlyList<OrganizationImportFieldMapping> Mappings, IReadOnlyList<int> LevelColumns);
    private sealed record CanonicalType(Guid Id, string Name);
    private sealed record Reservation(string Code, Guid OrgUnitId);
    private sealed record CanonicalUnit(Guid Id, string Code, uint Version, bool IsRoot, string? Name, Guid? TypeId, string? TypeName, Guid? ParentId, bool IsActive);
    private sealed class CanonicalSnapshot(IReadOnlyList<CanonicalUnit> units, IReadOnlyList<Reservation> reservations, IReadOnlyList<CanonicalType> types, string observationDigest)
    {
        public IReadOnlyList<CanonicalUnit> Units { get; } = units;
        public IReadOnlyList<CanonicalUnit> ActiveUnits { get; } = units.Where(unit => unit.IsActive).ToList();
        public IReadOnlyList<CanonicalType> Types { get; } = types;
        public string ObservationDigest { get; } = observationDigest;
        public IReadOnlyDictionary<Guid, CanonicalUnit> ById { get; } = units.ToDictionary(unit => unit.Id);
        public IReadOnlyDictionary<string, CanonicalUnit> ByCurrentCode { get; } = units.ToDictionary(unit => NormalizeCode(unit.Code), StringComparer.Ordinal);
        public IReadOnlyDictionary<string, CanonicalUnit> ByReservedCode { get; } = reservations
            .GroupBy(item => NormalizeCode(item.Code), StringComparer.Ordinal).Where(group => group.Select(item => item.OrgUnitId).Distinct().Count() == 1)
            .ToDictionary(group => group.Key, group => units.Single(unit => unit.Id == group.First().OrgUnitId), StringComparer.Ordinal);
    }
    private sealed class MutableNode(string id, string name, string? sourceBusinessCode, bool businessCodeGenerated,
        string? rawType, Guid? typeId, string? rawParent, string? parentNodeId, Guid? parentCanonicalId,
        string? sourceFusionId, bool isProposalRoot, IReadOnlyList<OrganizationImportSourceCell> sourceCells)
    {
        public string Id { get; } = id; public string Name { get; set; } = name.Trim();
        public string? SourceBusinessCode { get; set; } = Clean(sourceBusinessCode); public bool BusinessCodeGenerated { get; set; } = businessCodeGenerated;
        public string? RawType { get; } = Clean(rawType); public Guid? TypeId { get; set; } = typeId; public string? TypeName { get; set; }
        public string? RawParent { get; } = Clean(rawParent); public string? ParentNodeId { get; set; } = parentNodeId; public Guid? ParentCanonicalId { get; set; } = parentCanonicalId;
        public string? SourceFusionId { get; } = Clean(sourceFusionId); public bool IsProposalRoot { get; set; } = isProposalRoot;
        public Guid? CanonicalId { get; set; } public OrganizationImportNodeClassification Classification { get; set; } = OrganizationImportNodeClassification.Create;
        public IReadOnlyList<OrganizationImportCandidate> DescriptiveCandidates { get; set; } = [];
        public IReadOnlyList<OrganizationImportIdentityEvidence> IdentityEvidence { get; set; } = [];
        public List<OrganizationImportSourceCell> SourceCells { get; } = [.. sourceCells];
    }
    private sealed record IssueSeed(string Code, OrganizationImportIssueSeverity Severity, string Title, string Message,
        IReadOnlyList<MutableNode> Nodes, IReadOnlyList<string> RecoveryActions);
}
