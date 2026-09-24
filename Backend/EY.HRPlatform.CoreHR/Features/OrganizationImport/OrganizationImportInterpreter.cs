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
    /// <param name="decisions">Decisions to interpret instead of the persisted ones, without saving them.</param>
    Task<OrganizationImportInterpretation> InterpretAsync(
        OrganizationImportSession session,
        CancellationToken cancellationToken,
        OrganizationImportDecisions? decisions = null);
}

/// <summary>
/// Deterministic, side-effect-free interpretation. A Fusion-generated Business Code
/// suggestion is proposal data only and MUST NOT be used as canonical identity evidence.
/// </summary>
public sealed class OrganizationImportInterpreter : IOrganizationImportInterpreter
{
    private readonly CoreHRDbContext dbContext;
    private readonly ITenantContext tenantContext;
    private readonly IOrganizationImportMappingService mappingService;
    private readonly IOrganizationImportValidator validator;
    private readonly IOrganizationImportMatchReadinessService matchReadiness;

    public OrganizationImportInterpreter(CoreHRDbContext dbContext, ITenantContext tenantContext)
        : this(dbContext, tenantContext, new OrganizationImportMappingService(), new OrganizationImportValidator(), new OrganizationImportMatchReadinessService()) { }

    public OrganizationImportInterpreter(
        CoreHRDbContext dbContext,
        ITenantContext tenantContext,
        IOrganizationImportMappingService mappingService,
        IOrganizationImportValidator validator,
        IOrganizationImportMatchReadinessService? matchReadiness = null)
    {
        this.dbContext = dbContext;
        this.tenantContext = tenantContext;
        this.mappingService = mappingService;
        this.validator = validator;
        this.matchReadiness = matchReadiness ?? new OrganizationImportMatchReadinessService();
    }

    private static readonly JsonSerializerOptions DigestJson = new(JsonSerializerDefaults.Web);
    private static readonly Dictionary<string, string[]> FieldAliases = new(StringComparer.Ordinal)
    {
        [OrganizationImportFields.FusionOrgUnitId] = ["fusion orgunit id", "fusion org unit id", "orgunit id", "org unit id"],
        [OrganizationImportFields.BusinessCode] = ["business code", "unit code", "org code", "code", "org key"],
        [OrganizationImportFields.Name] = ["name", "unit name", "organization name", "org name", "structure label"],
        [OrganizationImportFields.Type] = ["type", "unit type", "organization type", "org type", "layer label"],
        [OrganizationImportFields.ParentBusinessCode] = ["parent business code", "parent code", "reports to code", "parent", "upstream ref"],
    };
    private static readonly Dictionary<string, string> TypeAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["org"] = "Organization", ["company"] = "Organization",
        ["businessunit"] = "Business Unit", ["business unit"] = "Business Unit", ["bu"] = "Business Unit",
        ["division"] = "Division", ["div"] = "Division",
        ["department"] = "Department", ["dept"] = "Department",
        ["team"] = "Team", ["unit"] = "Unit",
    };

    public async Task<OrganizationImportInterpretation> InterpretAsync(
        OrganizationImportSession session,
        CancellationToken cancellationToken,
        OrganizationImportDecisions? decisionsOverride = null)
    {
        if (session.Status != OrganizationImportStatus.Active)
            throw new InvalidOperationException("Only an active import can be interpreted.");
        var table = OrganizationImportJson.Deserialize(session.Source.SourceTableJson)
            ?? throw new OrganizationImportReviewException("SourceUnavailable", "The import source is no longer available.", StatusCodes.Status409Conflict);
        var decisions = (decisionsOverride
            ?? OrganizationImportJson.Deserialize<OrganizationImportDecisions>(session.DecisionsJson)
            ?? new OrganizationImportDecisions()).Normalize();
        var canonical = await LoadCanonicalAsync(session.EffectiveDate, cancellationToken);
        var typeOptions = canonical.Types.Select(type => new OrganizationImportTypeOption(type.Id, type.Name)).ToList();
        var persistedPlan = decisionsOverride is null
            ? OrganizationImportJson.Deserialize<OrganizationImportMappingPlan>(session.AppliedMappingPlanJson)
            : null;
        var mappingPlan = persistedPlan is { TypeMappingDetails: not null, Identity: not null, Digest: not null }
            ? persistedPlan
            : mappingService.CreatePlan(session, table, decisions, typeOptions, canonical.Units.Any(unit => unit.IsRoot));
        var inferred = new Inference(
            mappingPlan.SourceShape,
            mappingPlan.ShapeStatus,
            mappingPlan.ShapeOrigin,
            mappingPlan.ColumnMappings,
            mappingPlan.OrderedLevelColumns,
            mappingPlan.IgnoredColumns);
        inferred = ProtectAuthoritativeMappings(table, decisions, canonical, inferred);
        var effectivePlan = mappingPlan with { ColumnMappings = inferred.Mappings, IgnoredColumns = inferred.IgnoredColumns };
        var readiness = matchReadiness.Evaluate(effectivePlan);

        // Match-stage gaps (layout, name column, level columns, type vocabulary) are Match readiness,
        // derived from the plan. Only source-bound findings about the canonical result are collected here.
        var issues = new List<OrganizationImportIssue>();
        var nodes = inferred.Shape switch
        {
            OrganizationImportShape.LevelColumns when inferred.LevelColumns.Count >= 2 => BuildLevelNodes(table, inferred.LevelColumns, canonical, decisions),
            OrganizationImportShape.LevelColumns or OrganizationImportShape.Unresolved => [],
            _ => BuildRowNodes(table, inferred.Mappings),
        };

        ResolveTypes(nodes, canonical, decisions);
        ResolveParents(nodes, table, inferred.Mappings, canonical, issues);
        ResolveIdentityAndClassify(nodes, canonical, decisions, issues);
        ValidateExistingParentEvidence(nodes, canonical, issues);
        ApplyFreshRoot(nodes, canonical, decisions, issues);
        GenerateCreateCodes(nodes, canonical, issues);
        AttachCreatesToExistingParents(nodes, canonical, issues);
        var proposal = nodes.Select(ToProposalNode).ToList();

        var permanent = canonical.Units.SingleOrDefault(unit => unit.IsRoot);
        var draft = readiness.CanContinue
            ? OrganizationImportDraftBuilder.Build(session.EffectiveDate, proposal,
                permanent is null ? null : new CanonicalOrganizationRoot(permanent.Id, permanent.IsActive))
            : null;
        var validation = draft is null ? null : validator.Validate(draft, issues);

        return new OrganizationImportInterpretation(
            inferred.Shape, inferred.ShapeStatus, inferred.ShapeOrigin, inferred.Mappings,
            typeOptions,
            proposal,
            inferred.IgnoredColumns,
            effectivePlan,
            readiness,
            draft,
            validation,
            Anchors(proposal, canonical));
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

    private static Inference ProtectAuthoritativeMappings(
        OrganizationSourceTable table,
        OrganizationImportDecisions decisions,
        CanonicalSnapshot canonical,
        Inference inference)
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
            // A value that already identifies an existing unit keeps meaning that unit; the node's
            // Existing classification carries this, so it is not reported as an issue.
            mappings[index] = new(field, naturalColumn, OrganizationImportResolutionStatus.Resolved, OrganizationImportResolutionOrigin.Deterministic);
        }
        return inference with { Mappings = mappings };
    }

    private static List<MutableNode> BuildRowNodes(OrganizationSourceTable table, IReadOnlyList<OrganizationImportFieldMapping> mappings)
    {
        int? Column(string field) => mappings.Single(mapping => mapping.Field == field).ColumnIndex;
        var idColumn = Column(OrganizationImportFields.FusionOrgUnitId);
        var codeColumn = Column(OrganizationImportFields.BusinessCode);
        var nameColumn = Column(OrganizationImportFields.Name);
        var typeColumn = Column(OrganizationImportFields.Type);
        var parentColumn = Column(OrganizationImportFields.ParentBusinessCode);
        var nodes = new List<MutableNode>();
        if (nameColumn is null) return nodes;
        for (var index = 0; index < table.Rows.Count; index++)
        {
            var row = table.Rows[index];
            string? At(int? column) => column is int value && value < row.Count ? Clean(row[value]) : null;
            var name = At(nameColumn);
            if (name is null) continue;
            nodes.Add(new MutableNode($"row:{index + 1}", name, At(codeColumn), false,
                At(typeColumn), null, At(parentColumn), null, null,
                At(idColumn), false, Cells(index, row, [idColumn, codeColumn, nameColumn, typeColumn, parentColumn])));
        }
        return nodes;
    }

    private static List<MutableNode> BuildLevelNodes(OrganizationSourceTable table, IReadOnlyList<int> levelColumns,
        CanonicalSnapshot canonical, OrganizationImportDecisions decisions)
    {
        // A level-columns hierarchy is strictly depth-ordered, so each level's canonical type is a
        // structural fact, not a judgement: on a fresh organization Fusion types it deterministically
        // from its depth rather than asking a language model to re-derive an ordering it scrambles at an
        // affordable effort tier. An explicit built-in header or an administrator/AI type decision still
        // overrides the ladder. When a permanent root already exists the import is an expansion whose
        // top levels usually match existing units by identity, so the ladder is NOT imposed — those
        // level types fall to the normal identity/type-vocabulary flow instead of a wrong auto-type.
        var hasPermanentRoot = canonical.Units.Any(unit => unit.IsRoot);
        var applyDepthLadder = !hasPermanentRoot;
        var depthLadder = OrganizationImportLevelEvidence.DepthTypeLadder(levelColumns.Count, hasPermanentRoot: false);
        var depthByColumn = new Dictionary<int, int>();
        for (var position = 0; position < levelColumns.Count; position++) depthByColumn[levelColumns[position]] = position;
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
                    var rawLevelType = Clean(table.Columns[column].SourceLabel);
                    var isBuiltInType = TryBuiltInType(rawLevelType, out var typeName);
                    Guid? mappedTypeId = null;
                    if (rawLevelType is not null
                        && decisions.TypeMappings!.TryGetValue(rawLevelType, out var selectedTypeId)
                        && canonical.Types.Any(type => type.Id == selectedTypeId))
                    {
                        mappedTypeId = selectedTypeId;
                        typeName = canonical.Types.Single(type => type.Id == selectedTypeId).Name;
                    }
                    else if (applyDepthLadder && !isBuiltInType
                        && depthByColumn.TryGetValue(column, out var depth))
                    {
                        var ladderType = canonical.Types.FirstOrDefault(
                            type => Normalize(type.Name) == Normalize(depthLadder[depth]));
                        if (ladderType is not null)
                        {
                            mappedTypeId = ladderType.Id;
                            typeName = ladderType.Name;
                        }
                    }
                    node = new MutableNode(id, value, null, false,
                        rawLevelType ?? typeName, mappedTypeId, null, parentId, null,
                        null, false, []);
                    node.TypeName = typeName;
                    byPath.Add(path, node);
                    nodes.Add(node);
                }
                node.SourceCells.Add(new OrganizationImportSourceCell(rowIndex + 2, column, value));
                parentId = node.Id;
            }
        }
        return nodes;
    }

    private static void ResolveTypes(List<MutableNode> nodes, CanonicalSnapshot canonical, OrganizationImportDecisions decisions)
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
    }

    private static void ResolveParents(List<MutableNode> nodes, OrganizationSourceTable table,
        IReadOnlyList<OrganizationImportFieldMapping> mappings, CanonicalSnapshot canonical, List<OrganizationImportIssue> issues)
    {
        var sourceByCode = nodes.Where(node => node.SourceBusinessCode is not null)
            .GroupBy(node => NormalizeCode(node.SourceBusinessCode!)).Where(group => group.Count() == 1).ToDictionary(group => group.Key, group => group.Single(), StringComparer.Ordinal);
        var sourceByName = nodes.GroupBy(node => Normalize(node.Name)).Where(group => group.Count() == 1).ToDictionary(group => group.Key, group => group.Single(), StringComparer.Ordinal);
        var unresolved = new List<MutableNode>();
        foreach (var node in nodes)
        {
            if (node.ParentNodeId is not null || node.ParentCanonicalId is not null || node.RawParent is null) continue;
            var normalized = NormalizeCode(node.RawParent);
            if (sourceByCode.TryGetValue(normalized, out var sourceParent)) node.ParentNodeId = sourceParent.Id;
            else if (canonical.ByCurrentCode.TryGetValue(normalized, out var current)) node.ParentCanonicalId = current.Id;
            else if (canonical.ByReservedCode.TryGetValue(normalized, out var reserved)) node.ParentCanonicalId = reserved.Id;
            else if (sourceByName.TryGetValue(Normalize(node.RawParent), out var named)) node.ParentNodeId = named.Id;
            else unresolved.Add(node);
        }
        if (unresolved.Count == 0) return;

        // Where the fix belongs depends on why the reference didn't resolve. A reference that exists
        // in another column, or a parent column that mostly fails to resolve, points to the parent
        // column being interpreted wrongly (Match); an isolated value found nowhere is a source typo.
        var withParent = nodes.Count(node => node.RawParent is not null);
        var mostlyUnresolved = unresolved.Count >= 2 && unresolved.Count * 2 >= withParent;
        var mapped = mappings.Where(mapping => mapping.Field is OrganizationImportFields.Name or OrganizationImportFields.BusinessCode
                or OrganizationImportFields.ParentBusinessCode)
            .Select(mapping => mapping.ColumnIndex).OfType<int>().ToHashSet();
        var otherValues = table.Rows
            .SelectMany(row => row.Select((value, column) => (value, column)))
            .Where(cell => !mapped.Contains(cell.column) && Clean(cell.value) is not null)
            .Select(cell => NormalizeCode(cell.value!))
            .ToHashSet(StringComparer.Ordinal);
        foreach (var node in unresolved)
        {
            node.HasUnresolvedParent = true;
            var misread = mostlyUnresolved || otherValues.Contains(NormalizeCode(node.RawParent!));
            issues.Add(OrganizationImportIssueCatalog.ForNode(OrganizationImportIssueCodes.MissingParent,
                $"'{node.Name}' reports to '{node.RawParent}', which isn't a unit in this file or in your organization.",
                node.Id, node.SourceCells, OrganizationImportFields.ParentBusinessCode,
                misread
                    ? [OrganizationImportResolutionKind.ReturnToMatch, OrganizationImportResolutionKind.CorrectSource]
                    : [OrganizationImportResolutionKind.CorrectSource, OrganizationImportResolutionKind.ReturnToMatch]));
        }
    }

    private static void ResolveIdentityAndClassify(List<MutableNode> nodes, CanonicalSnapshot canonical, OrganizationImportDecisions decisions, List<OrganizationImportIssue> issues)
    {
        foreach (var node in nodes)
        {
            var evidence = new List<(string Identifier, string Supplied, CanonicalUnit Unit)>();
            var suppliedId = Guid.TryParse(node.SourceFusionId, out var parsedId) ? parsedId : (Guid?)null;
            if (suppliedId is Guid id)
            {
                if (!canonical.ById.TryGetValue(id, out var byId))
                    issues.Add(OrganizationImportIssueCatalog.ForNode(OrganizationImportIssueCodes.UnknownFusionId,
                        "The Fusion ID in this row doesn't match any unit in your organization. Correct it in the file, or clear it to add a new unit.",
                        node.Id, node.SourceCells, OrganizationImportFields.FusionOrgUnitId));
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
                issues.Add(OrganizationImportIssueCatalog.ForNode(OrganizationImportIssueCodes.IdentityContradiction,
                    "The ID and the business code in this row belong to two different existing units, so Fusion can't tell which one you mean.",
                    node.Id, node.SourceCells));
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
            // A same-name unit is never identity evidence: the node stays new unless the administrator
            // explicitly picks one of these candidates.
            node.DescriptiveCandidates = canonical.ActiveUnits.Where(unit => Normalize(unit.Name) == Normalize(node.Name)).Select(ToCandidate).ToList();
            node.Classification = OrganizationImportNodeClassification.Create;
            if (node.DescriptiveCandidates.Count > 0)
                issues.Add(OrganizationImportIssueCatalog.ForNode(OrganizationImportIssueCodes.PossibleExistingUnit,
                    $"Your organization already has a unit called '{node.Name}'. It will be added as a new unit unless you choose the existing one.",
                    node.Id, node.SourceCells));
        }
    }

    private static void BindExisting(MutableNode node, CanonicalUnit unit, CanonicalSnapshot canonical, OrganizationImportDecisions decisions,
        List<OrganizationImportIssue> issues, bool authoritative)
    {
        node.CanonicalId = unit.Id;
        node.DescriptiveCandidates = [];
        if (!unit.IsActive || unit.Name is null || unit.TypeId is null)
        {
            node.Classification = OrganizationImportNodeClassification.Conflict;
            issues.Add(OrganizationImportIssueCatalog.ForNode(OrganizationImportIssueCodes.ExistingUnavailableAsOfDate,
                $"'{unit.Name ?? unit.Code}' isn't active on the effective date.", node.Id, node.SourceCells));
            return;
        }
        var proposedParent = node.ParentCanonicalId;
        var parentMatches = node.ParentNodeId is null ? proposedParent == unit.ParentId : true;
        var matches = string.Equals(node.Name.Trim(), unit.Name, StringComparison.Ordinal)
            && node.TypeId == unit.TypeId && parentMatches;
        if (matches || decisions.KeepExistingNodeIds!.Contains(node.Id, StringComparer.Ordinal))
        {
            node.Classification = OrganizationImportNodeClassification.Existing;
            node.Name = unit.Name;
            node.SourceBusinessCode = unit.Code;
            node.TypeId = unit.TypeId;
            node.TypeName = unit.TypeName;
            node.ParentCanonicalId = unit.ParentId;
            if (!decisions.KeepExistingNodeIds!.Contains(node.Id, StringComparer.Ordinal)) node.ProposedParentNodeId = node.ParentNodeId;
            node.ParentNodeId = null;
            return;
        }
        node.Classification = OrganizationImportNodeClassification.Conflict;
        issues.Add(OrganizationImportIssueCatalog.ForNode(OrganizationImportIssueCodes.ExistingDifference,
            authoritative
                ? $"'{unit.Name}' already exists and the file describes it differently. Import doesn't change existing units: keep the current version or fix the file."
                : $"The existing unit you chose, '{unit.Name}', differs from the file. Import doesn't change existing units: keep the current version or choose again.",
            node.Id, node.SourceCells, resolutions: authoritative
                ? null
                : [OrganizationImportResolutionKind.KeepExisting, OrganizationImportResolutionKind.ChooseExistingUnit]));
    }

    private static void ApplyFreshRoot(List<MutableNode> nodes, CanonicalSnapshot canonical, OrganizationImportDecisions decisions, List<OrganizationImportIssue> issues)
    {
        var permanentRoot = canonical.Units.SingleOrDefault(unit => unit.IsRoot);
        if (permanentRoot is not null)
        {
            foreach (var node in nodes.Where(node => node.Classification == OrganizationImportNodeClassification.Create
                         && node.ParentNodeId is null && node.ParentCanonicalId is null && !node.HasUnresolvedParent))
                node.ParentCanonicalId = permanentRoot.IsActive ? permanentRoot.Id : null;
            foreach (var node in nodes.Where(node => node.Classification == OrganizationImportNodeClassification.Create && node.TypeId == OrganizationalUnitTypeCatalog.OrganizationId))
                issues.Add(OrganizationImportIssueCatalog.ForNode(OrganizationImportIssueCodes.SecondOrganizationRoot,
                    $"'{node.Name}' is typed as an Organization, but your organization already has its top-level Organization.",
                    node.Id, node.SourceCells, OrganizationImportFields.Type));
            if (!permanentRoot.IsActive)
                issues.Add(OrganizationImportIssueCatalog.ForNodes(OrganizationImportIssueCodes.RootUnavailableAsOfDate,
                    "The top of your organization isn't active on the effective date. Choose a later date.", []));
            return;
        }

        // Root meaning is structural: a single parentless unit with the rest of the hierarchy
        // connected beneath it is unambiguously the organization root, whatever its source type.
        // Several parentless units need one organization above them, which only the administrator
        // can add; until then the validator reports MultipleRoots.
        var top = nodes.Where(node => node.Classification != OrganizationImportNodeClassification.Conflict
            && node.ParentNodeId is null && node.ParentCanonicalId is null && !node.HasUnresolvedParent).ToList();
        if (top.Count == 1) { top[0].IsProposalRoot = true; return; }
        if (top.Count < 2 || decisions.IntroducedRoot is null) return;
        var root = new MutableNode(OrganizationImportDraftBuilder.IntroducedRootId, decisions.IntroducedRoot.Name, decisions.IntroducedRoot.BusinessCode, false,
            "Organization", OrganizationalUnitTypeCatalog.OrganizationId, null, null, null, null, true, []);
        root.TypeName = canonical.Types.SingleOrDefault(type => type.Id == OrganizationalUnitTypeCatalog.OrganizationId)?.Name ?? "Organization";
        root.Classification = OrganizationImportNodeClassification.Create;
        nodes.Insert(0, root);
        foreach (var node in top) node.ParentNodeId = root.Id;
    }

    /// <summary>
    /// An existing unit the file places under a different proposed parent would be a move, which
    /// import never performs. Runs after every node is classified, so the proposed parent is known.
    /// </summary>
    private static void ValidateExistingParentEvidence(List<MutableNode> nodes, CanonicalSnapshot canonical, List<OrganizationImportIssue> issues)
    {
        var byNodeId = nodes.ToDictionary(node => node.Id, StringComparer.Ordinal);
        foreach (var node in nodes.Where(node => node.Classification == OrganizationImportNodeClassification.Existing && node.ProposedParentNodeId is not null))
        {
            if (!canonical.ById.TryGetValue(node.CanonicalId!.Value, out var existing)
                || !byNodeId.TryGetValue(node.ProposedParentNodeId!, out var proposedParent)
                || proposedParent.CanonicalId == existing.ParentId)
                continue;
            node.Classification = OrganizationImportNodeClassification.Conflict;
            issues.Add(OrganizationImportIssueCatalog.ForNode(OrganizationImportIssueCodes.ExistingDifference,
                $"'{existing.Name}' already exists under a different parent. Import doesn't move existing units: keep it where it is, or fix the file.",
                node.Id, node.SourceCells, OrganizationImportFields.ParentBusinessCode));
        }
    }

    /// <summary>
    /// Fusion owns generated identities, so it resolves their collisions itself (deterministic
    /// numeric suffixes) instead of asking anyone to edit a code.
    /// </summary>
    private static void GenerateCreateCodes(List<MutableNode> nodes, CanonicalSnapshot canonical, List<OrganizationImportIssue> issues)
    {
        var occupied = canonical.ByCurrentCode.Keys.Concat(canonical.ByReservedCode.Keys).ToHashSet(StringComparer.Ordinal);
        foreach (var node in nodes
                     .Where(node => node.Classification == OrganizationImportNodeClassification.Create && string.IsNullOrWhiteSpace(node.SourceBusinessCode))
                     .OrderBy(node => node.Id, StringComparer.Ordinal))
        {
            var baseCode = SuggestCode(node.Name);
            var candidate = baseCode;
            var suffix = 2;
            while (!occupied.Add(candidate))
            {
                var suffixText = $"-{suffix++}";
                candidate = baseCode[..Math.Min(baseCode.Length, 50 - suffixText.Length)] + suffixText;
            }
            node.SourceBusinessCode = candidate;
            node.BusinessCodeGenerated = true;
        }
        foreach (var node in nodes.Where(node => node.Classification == OrganizationImportNodeClassification.Create))
        {
            var code = node.SourceBusinessCode is null ? string.Empty : NormalizeCode(node.SourceBusinessCode);
            node.SourceBusinessCode = code;
            if (!node.BusinessCodeGenerated && (canonical.ByCurrentCode.ContainsKey(code) || canonical.ByReservedCode.ContainsKey(code)))
                issues.Add(OrganizationImportIssueCatalog.ForNode(OrganizationImportIssueCodes.BusinessCodeTaken,
                    $"The business code '{code}' already belongs to another unit.", node.Id, node.SourceCells, OrganizationImportFields.BusinessCode,
                    node.Id == OrganizationImportDraftBuilder.IntroducedRootId ? [OrganizationImportResolutionKind.AddOrganizationRoot] : null));
        }
    }

    /// <summary>
    /// A new unit under a unit that already exists hangs from that existing unit directly, which must
    /// be active on the effective date.
    /// </summary>
    private static void AttachCreatesToExistingParents(List<MutableNode> nodes, CanonicalSnapshot canonical, List<OrganizationImportIssue> issues)
    {
        var proposalById = nodes.ToDictionary(node => node.Id, StringComparer.Ordinal);
        foreach (var node in nodes.Where(node => node.Classification == OrganizationImportNodeClassification.Create && node.ParentNodeId is not null))
        {
            if (!proposalById.TryGetValue(node.ParentNodeId!, out var proposedParent)
                || proposedParent.Classification != OrganizationImportNodeClassification.Existing
                || proposedParent.CanonicalId is not Guid canonicalParentId)
                continue;
            node.ParentNodeId = null;
            node.ParentCanonicalId = canonicalParentId;
        }
        foreach (var node in nodes.Where(node => node.Classification == OrganizationImportNodeClassification.Create && node.ParentCanonicalId is Guid))
        {
            if (canonical.ActiveUnits.Any(parent => parent.Id == node.ParentCanonicalId)) continue;
            var parent = canonical.ById.GetValueOrDefault(node.ParentCanonicalId!.Value);
            issues.Add(OrganizationImportIssueCatalog.ForNode(OrganizationImportIssueCodes.ExistingUnavailableAsOfDate,
                $"The parent of '{node.Name}', '{parent?.Name ?? parent?.Code}', isn't active on the effective date.",
                node.Id, node.SourceCells, OrganizationImportFields.ParentBusinessCode));
        }
    }

    /// <summary>Existing units the proposal hangs from, and their ancestors, so the hierarchy renders connected.</summary>
    private static IReadOnlyList<OrganizationImportReviewAnchor> Anchors(IReadOnlyList<OrganizationImportProposalNode> proposal, CanonicalSnapshot canonical)
    {
        var represented = proposal.Where(node => node.Classification == OrganizationImportNodeClassification.Existing && node.CanonicalId is not null)
            .Select(node => node.CanonicalId!.Value).ToHashSet();
        var anchors = new Dictionary<Guid, OrganizationImportReviewAnchor>();
        foreach (var start in proposal.Select(node => node.ParentCanonicalId).OfType<Guid>().Distinct())
        {
            Guid? cursor = start;
            while (cursor is Guid id && !anchors.ContainsKey(id) && canonical.ById.TryGetValue(id, out var unit))
            {
                if (!represented.Contains(id))
                    anchors[id] = new OrganizationImportReviewAnchor(unit.Id, unit.Name ?? unit.Code, unit.Code, unit.TypeName, unit.ParentId, unit.IsRoot);
                cursor = unit.ParentId;
                if (represented.Contains(id)) break;
            }
        }
        return anchors.Values.OrderBy(anchor => anchor.Id).ToList();
    }

    private static OrganizationImportProposalNode ToProposalNode(MutableNode node) => new(node.Id, node.Name, node.SourceBusinessCode,
        node.BusinessCodeGenerated, node.RawType, node.TypeId, node.TypeName, node.ParentNodeId, node.ParentCanonicalId, node.RawParent, node.CanonicalId,
        node.Classification, node.IsProposalRoot, node.HasUnresolvedParent, node.DescriptiveCandidates, node.SourceCells, node.IdentityEvidence);
    private static OrganizationImportCandidate ToCandidate(CanonicalUnit unit) => new(unit.Id, unit.Code, unit.Name!, unit.TypeId!.Value, unit.TypeName!, unit.ParentId);
    private static List<OrganizationImportSourceCell> Cells(int rowIndex, IReadOnlyList<string?> row, IEnumerable<int?> columns)
        => columns.Where(column => column is not null).Select(column => column!.Value).Distinct().Where(column => column < row.Count)
            .Select(column => new OrganizationImportSourceCell(rowIndex + 2, column, row[column])).ToList();
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
        var slug = string.Join('-', words);
        return string.IsNullOrWhiteSpace(slug) ? "UNIT" : slug[..Math.Min(50, slug.Length)];
    }
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string Normalize(string? value) => new((value ?? string.Empty).Trim().ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
    private static string NormalizeCode(string value) => value.Trim().ToUpperInvariant();
    private static string Hash(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private sealed record Inference(OrganizationImportShape Shape, OrganizationImportResolutionStatus ShapeStatus,
        OrganizationImportResolutionOrigin ShapeOrigin, IReadOnlyList<OrganizationImportFieldMapping> Mappings, IReadOnlyList<int> LevelColumns,
        IReadOnlyList<OrganizationImportIgnoredColumn> IgnoredColumns);
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
        public bool HasUnresolvedParent { get; set; }
        public string? ProposedParentNodeId { get; set; }
        public Guid? CanonicalId { get; set; } public OrganizationImportNodeClassification Classification { get; set; } = OrganizationImportNodeClassification.Create;
        public IReadOnlyList<OrganizationImportCandidate> DescriptiveCandidates { get; set; } = [];
        public IReadOnlyList<OrganizationImportIdentityEvidence> IdentityEvidence { get; set; } = [];
        public List<OrganizationImportSourceCell> SourceCells { get; } = [.. sourceCells];
    }
}
