using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

public sealed class WorkforceImportReviewException(string message, string code = "ReviewRejected") : Exception(message)
{
    public string Code { get; } = code;
}

/// <summary>Bounded Review resolutions. Each field is optional; only the present ones change.</summary>
public sealed record WorkforceResolutionsUpdateRequest(
    string? OrganizationSourceValue = null,
    Guid? OrganizationUnitId = null,
    string? ManagerReference = null,
    Guid? ManagerEmployeeId = null,
    string? ManagerEmployeeKey = null,
    int? ManagerImportRowNumber = null,
    bool? NoManager = null,
    int? KeepAsDistinctRow = null,
    bool? UseBaselineForWorkDates = null);

/// <summary>
/// Match and Review over one derivation chain. Match changes the plan (what the source means);
/// Review resolutions answer specific live issues (which canonical unit or person an unresolved
/// reference means). Neither ever overrides a source fact. Every change re-derives the proposal and
/// persists the row projections, so paging, filtering, search and counts never re-run the resolver.
/// </summary>
public sealed class WorkforceImportReviewService(
    CoreHRDbContext context,
    WorkforceImportDerivation derivation,
    WorkforceImportSemanticAssistanceService semantic)
{
    private const int MaxPageSize = 100;

    /// <summary>Resolve a public stable Employee Key to its canonical id (raw GUIDs are never public).</summary>
    public Task<Guid?> ResolveEmployeeKeyAsync(string employeeKey, CancellationToken cancellationToken)
        => context.Employees.AsNoTracking()
            .Where(e => e.StableEmployeeKey == employeeKey)
            .Select(e => (Guid?)e.Id)
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<WorkforceMatchDto> DescribeMatchAsync(WorkforceImportSession session, CancellationToken cancellationToken)
    {
        var rows = await context.WorkforceImportRows.AsNoTracking().Where(r => r.SessionId == session.Id).ToListAsync(cancellationToken);
        var match = await derivation.InterpretAsync(session, rows, cancellationToken);
        var semanticState = await semantic.DescribeAsync(session, match, cancellationToken);
        return BuildMatch(match, semanticState);
    }

    /// <summary>Re-derive against current CoreHR without a decision change (Refresh).</summary>
    public async Task<WorkforceImportSession> RefreshAsync(Guid sessionId, uint ifMatchVersion, CancellationToken cancellationToken)
    {
        var session = await LoadSessionAsync(sessionId, ifMatchVersion, cancellationToken);
        await derivation.RecomputeAsync(session, cancellationToken);
        await SaveAsync(sessionId, cancellationToken);
        return session;
    }

    /// <summary>
    /// Changes the workforce-as-of date. The date is an input to the proposal: it decides who is active
    /// or former and which units and people exist. Resolutions that no longer answer a live issue on the
    /// new date are dropped, then the proposal (and its fingerprint) is re-derived.
    /// </summary>
    public async Task<WorkforceImportSession> ChangeBaselineDateAsync(
        Guid sessionId, uint ifMatchVersion, DateOnly baselineDate, ImportActor actor, CancellationToken cancellationToken)
    {
        var session = await LoadSessionAsync(sessionId, ifMatchVersion, cancellationToken);
        try { session.ChangeBaselineDate(baselineDate, actor, DateTime.UtcNow); }
        catch (InvalidOperationException ex) when (session.IsActive)
        {
            throw new WorkforceImportReviewException(ex.Message, "BaselineNotAllowed");
        }
        var rows = await context.WorkforceImportRows.AsNoTracking().Where(r => r.SessionId == sessionId).ToListAsync(cancellationToken);
        var unresolved = await derivation.DeriveAsync(session, rows, cancellationToken, resolutions: new WorkforceImportResolutions());
        KeepLiveResolutions(session, unresolved, actor);
        await derivation.RecomputeAsync(session, cancellationToken);
        await SaveAsync(sessionId, cancellationToken);
        return session;
    }

    /// <summary>
    /// Keeps only resolutions that still answer an issue the proposal has without them, and whose answer
    /// is still valid (the unit exists, the manager is current or still being imported).
    /// </summary>
    private static void KeepLiveResolutions(WorkforceImportSession session, WorkforceImportDerived unresolved, ImportActor actor)
    {
        var resolutions = WorkforceImportResolutions.Parse(session.ResolutionsJson);
        if (resolutions.IsEmpty) return;
        var live = unresolved.Proposal.Rows.SelectMany(r => r.Issues).Where(i => i.DecisionKey is not null)
            .Select(i => i.DecisionKey!).ToHashSet(StringComparer.Ordinal);
        var imported = unresolved.Proposal.Rows.Where(r => r.Classification != WorkforceImportRowClassification.NotImported)
            .Select(r => r.SourceRowNumber).ToHashSet();
        var snapshot = unresolved.Snapshot;

        var changed = false;
        foreach (var (key, unitId) in resolutions.OrganizationBySourceValue.ToList())
            if (!live.Contains($"org:{key}") || !snapshot.OrgById.ContainsKey(unitId))
                changed |= resolutions.OrganizationBySourceValue.Remove(key);
        foreach (var (key, employeeId) in resolutions.ManagerEmployeeByReference.ToList())
            if (!live.Contains($"mgr:{key}") || !snapshot.ByFusionId.TryGetValue(employeeId, out var manager) || manager.IsFormer)
                changed |= resolutions.ManagerEmployeeByReference.Remove(key);
        foreach (var (key, row) in resolutions.ManagerImportRowByReference.ToList())
            if (!live.Contains($"mgr:{key}") || !imported.Contains(row))
                changed |= resolutions.ManagerImportRowByReference.Remove(key);
        changed |= resolutions.NoManagerByReference.RemoveWhere(k => !live.Contains($"mgr:{k}")) > 0;
        changed |= resolutions.KeepAsDistinctRows.RemoveWhere(r => !live.Contains($"dup:{r}")) > 0;
        if (resolutions.UseBaselineForWorkDates
            && !unresolved.Interpretation.Rows.Any(r => r.Issues.Any(i => i.Field == WorkforceImportField.WorkEffectiveFrom)))
        {
            resolutions.UseBaselineForWorkDates = false;
            changed = true;
        }
        if (changed) session.ReplaceResolutions(resolutions.Serialize(), actor);
    }

    /// <summary>
    /// Changes what the source means. The administrator's decision always wins and is recorded with
    /// Administrator origin; replacing a semantic suggestion counts as an override.
    /// </summary>
    public async Task<WorkforceImportSession> UpdateMatchAsync(
        Guid sessionId, uint ifMatchVersion, WorkforceMatchUpdateRequest request, ImportActor actor, CancellationToken cancellationToken)
    {
        var session = await LoadSessionAsync(sessionId, ifMatchVersion, cancellationToken);
        var plan = WorkforceImportMappingPlan.Parse(session.MappingPlanJson);
        var columnCount = session.Source.ColumnCount;
        var overridden = 0;

        if (request.ColumnMappings is { } mappings)
        {
            if (mappings.Count > 256) throw new WorkforceImportReviewException("Too many column changes at once.");
            foreach (var (index, field) in mappings)
            {
                if (index < 0 || index >= columnCount) throw new WorkforceImportReviewException("That column isn't in this file.");
                if (plan.ColumnOrigins.GetValueOrDefault(index) == ImportResolutionOrigin.SemanticSuggestion && plan.ColumnMappings.GetValueOrDefault(index) != field)
                    overridden++;
                plan.ColumnMappings[index] = field;
                plan.ColumnOrigins[index] = ImportResolutionOrigin.Administrator;
            }
        }
        if (request.DateFormat is { } dateFormat) { plan.DateFormat = dateFormat; plan.FormatOrigin = ImportResolutionOrigin.Administrator; }
        if (request.NameFormat is { } nameFormat) { plan.NameFormat = nameFormat; plan.FormatOrigin = ImportResolutionOrigin.Administrator; }
        if (request.IdentityStrategy is { } strategy) plan.IdentityStrategy = strategy;
        if (request.LifecycleVocabulary is { } vocabulary)
        {
            if (vocabulary.Count > 64) throw new WorkforceImportReviewException("Too many status values at once.");
            foreach (var (value, meaning) in vocabulary)
            {
                var key = WorkforceLifecycleVocabulary.Normalize(value);
                if (plan.VocabularyOrigins.GetValueOrDefault(key) == ImportResolutionOrigin.SemanticSuggestion && plan.LifecycleVocabulary.GetValueOrDefault(key) != meaning)
                    overridden++;
                plan.LifecycleVocabulary[key] = meaning;
                plan.VocabularyOrigins[key] = ImportResolutionOrigin.Administrator;
            }
        }

        session.ReplaceMappingPlan(plan.Serialize(), actor);
        var derived = await derivation.RecomputeAsync(session, cancellationToken);
        PruneResolutions(session, derived, actor);
        if (overridden > 0) await semantic.RecordOverridesAsync(sessionId, overridden, cancellationToken);
        await SaveAsync(sessionId, cancellationToken);
        return session;
    }

    /// <summary>
    /// Records a bounded Review resolution. It is accepted only when it answers an issue the proposal
    /// actually has without it; a resolution can never override a reference that already resolved.
    /// </summary>
    public async Task<WorkforceReviewSummaryDto> UpdateResolutionsAsync(
        Guid sessionId, uint ifMatchVersion, WorkforceResolutionsUpdateRequest request, ImportActor actor, CancellationToken cancellationToken)
    {
        var session = await LoadSessionAsync(sessionId, ifMatchVersion, cancellationToken);
        if (!session.MatchComplete) throw new WorkforceImportReviewException("Finish matching before reviewing.", "MatchIncomplete");
        var resolutions = WorkforceImportResolutions.Parse(session.ResolutionsJson);
        var rows = await context.WorkforceImportRows.AsNoTracking().Where(r => r.SessionId == sessionId).ToListAsync(cancellationToken);
        var baseline = await derivation.DeriveAsync(session, rows, cancellationToken, resolutions: new WorkforceImportResolutions());
        var liveKeys = baseline.Proposal.Rows.SelectMany(r => r.Issues).Where(i => i.DecisionKey is not null)
            .Select(i => i.DecisionKey!).ToHashSet(StringComparer.Ordinal);

        if (request.OrganizationSourceValue is { } orgValue)
        {
            var normalized = WorkforceCanonicalSnapshot.NormalizeOrg(orgValue);
            if (!liveKeys.Contains($"org:{normalized}"))
                throw new WorkforceImportReviewException("That organization value already matches a unit.", "ResolutionNotNeeded");
            if (request.OrganizationUnitId is not { } unitId || !baseline.Snapshot.OrgById.ContainsKey(unitId))
                throw new WorkforceImportReviewException("Choose a unit that exists on the workforce-as-of date.");
            resolutions.OrganizationBySourceValue[normalized] = unitId;
        }

        if (request.ManagerReference is { } managerReference)
        {
            var key = WorkforceCanonicalSnapshot.NormalizeNumber(managerReference);
            if (!liveKeys.Contains($"mgr:{key}"))
                throw new WorkforceImportReviewException("That manager reference already matches someone.", "ResolutionNotNeeded");
            resolutions.ManagerEmployeeByReference.Remove(key);
            resolutions.ManagerImportRowByReference.Remove(key);
            resolutions.NoManagerByReference.Remove(key);
            var managerId = request.ManagerEmployeeId;
            if (managerId is null && !string.IsNullOrWhiteSpace(request.ManagerEmployeeKey))
                managerId = await ResolveEmployeeKeyAsync(request.ManagerEmployeeKey, cancellationToken)
                    ?? throw new WorkforceImportReviewException("That employee couldn't be found.");
            if (managerId is { } existingManager)
            {
                if (!baseline.Snapshot.ByFusionId.TryGetValue(existingManager, out var manager) || manager.IsFormer)
                    throw new WorkforceImportReviewException("Choose a current employee as manager.");
                resolutions.ManagerEmployeeByReference[key] = existingManager;
            }
            else if (request.ManagerImportRowNumber is { } managerRow)
            {
                var target = baseline.Proposal.Rows.FirstOrDefault(r => r.SourceRowNumber == managerRow);
                if (target is null || target.Classification is WorkforceImportRowClassification.NotImported)
                    throw new WorkforceImportReviewException("Choose someone who is being imported.");
                resolutions.ManagerImportRowByReference[key] = managerRow;
            }
            else if (request.NoManager == true)
                resolutions.NoManagerByReference.Add(key);
            else
                throw new WorkforceImportReviewException("Choose a manager or no manager.");
        }

        if (request.KeepAsDistinctRow is { } distinctRow)
        {
            if (!liveKeys.Contains($"dup:{distinctRow}"))
                throw new WorkforceImportReviewException("That row isn't a possible duplicate.", "ResolutionNotNeeded");
            resolutions.KeepAsDistinctRows.Add(distinctRow);
        }

        if (request.UseBaselineForWorkDates is { } useBaseline)
        {
            var hasWorkDateIssue = baseline.Interpretation.Rows.Any(r => r.Issues.Any(i => i.Field == WorkforceImportField.WorkEffectiveFrom));
            if (useBaseline && !hasWorkDateIssue)
                throw new WorkforceImportReviewException("Every work start date is already usable.", "ResolutionNotNeeded");
            resolutions.UseBaselineForWorkDates = useBaseline;
        }

        session.ReplaceResolutions(resolutions.Serialize(), actor);
        await derivation.RecomputeAsync(session, cancellationToken);
        await SaveAsync(sessionId, cancellationToken);
        return await SummarizeAsync(session, cancellationToken);
    }

    public async Task<WorkforceReviewPageDto> GetReviewPageAsync(
        Guid sessionId, string? filter, string? search, int page, int pageSize, CancellationToken cancellationToken)
    {
        var session = await context.WorkforceImportSessions.AsNoTracking().Include(s => s.Source)
            .SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken)
            ?? throw new WorkforceImportNotFoundException(sessionId);
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        // Bounded server-side query over persisted row projections: no full-file materialization.
        var query = context.WorkforceImportRows.AsNoTracking().Where(r => r.SessionId == sessionId);
        if (string.Equals(filter, "Warnings", StringComparison.OrdinalIgnoreCase))
            query = query.Where(r => r.HasWarning && r.Classification != WorkforceImportRowClassification.Blocked);
        else if (Enum.TryParse<WorkforceImportRowClassification>(filter, ignoreCase: true, out var classification))
            query = query.Where(r => r.Classification == classification);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{EscapeLike(search.Trim().ToLowerInvariant())}%";
            query = query.Where(r => r.SearchText != null && EF.Functions.Like(r.SearchText, term, "\\"));
        }

        var total = await query.CountAsync(cancellationToken);
        var pageRows = await query.OrderBy(r => r.SourceRowNumber)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new WorkforceReviewPageDto(
            pageRows.Select(WorkforceImportProjection.ToRowDto).ToList(), page, pageSize, total,
            await SummarizeAsync(session, cancellationToken));
    }

    /// <summary>
    /// People in this import who could be the manager. A name only ranks candidates for an explicit
    /// choice; it never resolves a manager on its own.
    /// </summary>
    public async Task<IReadOnlyList<WorkforceManagerCandidateDto>> GetImportManagerCandidatesAsync(
        Guid sessionId, string? reference, string? query, CancellationToken cancellationToken)
    {
        var term = (query ?? string.Empty).Trim();
        if (term.Length == 0 && !string.IsNullOrWhiteSpace(reference)) term = DeriveNameHint(reference);
        var folded = term.ToLowerInvariant();

        var candidates = context.WorkforceImportRows.AsNoTracking()
            .Where(r => r.SessionId == sessionId
                && r.Classification != WorkforceImportRowClassification.NotImported
                && r.Classification != WorkforceImportRowClassification.Existing);
        if (folded.Length > 0)
        {
            var pattern = $"%{EscapeLike(folded)}%";
            candidates = candidates.Where(r => r.SearchText != null && EF.Functions.Like(r.SearchText, pattern, "\\"));
        }
        var rows = await candidates.OrderBy(r => r.SourceRowNumber).Take(8)
            .Select(r => new { r.SourceRowNumber, r.NormalizedProposalJson })
            .ToListAsync(cancellationToken);
        return rows
            .Select(r => (r.SourceRowNumber, Projection: WorkforceImportProjection.ReadProjection(r.NormalizedProposalJson)))
            .Where(r => r.Projection is not null)
            .Select(r => new WorkforceManagerCandidateDto(r.SourceRowNumber, r.Projection!.DisplayName, r.Projection.EmployeeNumber, r.Projection.NumberGenerated, r.Projection.DisplayTitle))
            .ToList();
    }

    public async Task<WorkforceReviewSummaryDto> SummarizeAsync(WorkforceImportSession session, CancellationToken cancellationToken)
    {
        var groups = await ComputeIssueGroupsAsync(session.Id, cancellationToken);
        var openDecisions = groups.Where(g => g.Severity == ImportIssueSeverity.Blocker).Sum(g => g.DecisionCount);
        var total = session.CreateCount + session.ExistingCount + session.BlockedCount + session.NotImportedCount;
        var counts = new WorkforceReviewCountsDto(session.CreateCount, session.ExistingCount, session.NotImportedCount, session.BlockedCount,
            total, session.WarningCount, openDecisions);
        var state = total == 0 ? WorkforceReviewState.NoRows
            : session.CreateCount == 0 && session.BlockedCount == 0 ? WorkforceReviewState.NothingToImport
            : WorkforceReviewState.Reviewable;
        return new WorkforceReviewSummaryDto(counts, session.CanPublish, state, session.Version, session.ProposalFingerprint, groups);
    }

    /// <summary>
    /// What remains, by kind: grouped decisions count once however many people they touch; a
    /// row-specific blocker counts once per row. Warnings are grouped the same way as notices.
    /// </summary>
    private async Task<IReadOnlyList<WorkforceReviewIssueGroupDto>> ComputeIssueGroupsAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var jsons = await context.WorkforceImportRows.AsNoTracking()
            .Where(r => r.SessionId == sessionId && (r.Classification == WorkforceImportRowClassification.Blocked || r.HasWarning))
            .Select(r => r.IssueStateJson)
            .ToListAsync(cancellationToken);

        var groupedKeys = new Dictionary<(string, ImportIssueSeverity), HashSet<string>>();
        var rowSpecific = new Dictionary<(string, ImportIssueSeverity), int>();
        var people = new Dictionary<(string, ImportIssueSeverity), int>();
        foreach (var json in jsons)
        {
            var issues = WorkforceImportProjection.ReadIssues(json);
            var onRow = new HashSet<(string, ImportIssueSeverity)>();
            foreach (var issue in issues)
            {
                var key = (issue.Category, issue.Severity);
                onRow.Add(key);
                if (issue.DecisionKey is not null)
                {
                    if (!groupedKeys.TryGetValue(key, out var set)) groupedKeys[key] = set = new(StringComparer.Ordinal);
                    set.Add(issue.DecisionKey);
                }
            }
            foreach (var key in onRow)
            {
                people[key] = people.GetValueOrDefault(key) + 1;
                if (issues.Any(i => i.DecisionKey is null && (i.Category, i.Severity) == key))
                    rowSpecific[key] = rowSpecific.GetValueOrDefault(key) + 1;
            }
        }

        var order = new[] { "organization", "manager", "identity", "dates", "data", "lifecycle", "existing" };
        return people.Keys
            .OrderBy(k => k.Item2)
            .ThenBy(k => Array.IndexOf(order, k.Item1) is var i && i < 0 ? order.Length : i)
            .Select(k => new WorkforceReviewIssueGroupDto(k.Item1, k.Item2,
                (groupedKeys.GetValueOrDefault(k)?.Count ?? 0) + rowSpecific.GetValueOrDefault(k), people[k]))
            .ToList();
    }

    /// <summary>A Match change can make earlier resolutions moot; keep only those that still answer a live issue.</summary>
    private static void PruneResolutions(WorkforceImportSession session, WorkforceImportDerived derived, ImportActor actor)
    {
        var resolutions = derived.Resolutions;
        if (resolutions.IsEmpty) return;
        var sourceOrgValues = derived.Interpretation.Rows.Select(r => r.OrganizationRef).Where(v => !string.IsNullOrWhiteSpace(v))
            .Select(v => WorkforceCanonicalSnapshot.NormalizeOrg(v!)).ToHashSet(StringComparer.Ordinal);
        var sourceManagerRefs = derived.Interpretation.Rows.SelectMany(r => new[] { r.ManagerKey, r.ManagerReference })
            .Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => WorkforceCanonicalSnapshot.NormalizeNumber(v!)).ToHashSet(StringComparer.Ordinal);
        var rowNumbers = derived.Interpretation.Rows.Select(r => r.SourceRowNumber).ToHashSet();

        var changed = false;
        foreach (var key in resolutions.OrganizationBySourceValue.Keys.Where(k => !sourceOrgValues.Contains(k)).ToList())
            changed |= resolutions.OrganizationBySourceValue.Remove(key);
        foreach (var key in resolutions.ManagerEmployeeByReference.Keys.Where(k => !sourceManagerRefs.Contains(k)).ToList())
            changed |= resolutions.ManagerEmployeeByReference.Remove(key);
        foreach (var key in resolutions.ManagerImportRowByReference.Keys.Where(k => !sourceManagerRefs.Contains(k)).ToList())
            changed |= resolutions.ManagerImportRowByReference.Remove(key);
        changed |= resolutions.NoManagerByReference.RemoveWhere(k => !sourceManagerRefs.Contains(k)) > 0;
        changed |= resolutions.KeepAsDistinctRows.RemoveWhere(r => !rowNumbers.Contains(r)) > 0;
        if (changed) session.ReplaceResolutions(resolutions.Serialize(), actor);
    }

    private const int MatchPreviewRowLimit = 25;

    private static WorkforceMatchDto BuildMatch(WorkforceImportMatchState derived, EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic.ImportSemanticAssistanceDto semanticState)
    {
        var columns = derived.Interpretation.Mappings.Select(m =>
        {
            var values = derived.Cells.Select(row => m.ColumnIndex < row.Count ? row[m.ColumnIndex] : null)
                .Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => v!.Trim()).ToList();
            return new WorkforceMatchColumnDto(m.ColumnIndex, m.Label, m.Field, m.Origin, m.Resolved, values.Count,
                values.Distinct(StringComparer.Ordinal).Take(3).ToList());
        }).ToList();
        return new WorkforceMatchDto(
            columns,
            derived.Plan.DateFormat,
            derived.Plan.NameFormat,
            derived.Interpretation.DateFormatDecisionNeeded,
            derived.Interpretation.NameFormatDecisionNeeded,
            derived.Plan.IdentityStrategy,
            !derived.TenantHasEmployees,
            derived.Interpretation.LifecycleValues
                .Select(v => new WorkforceLifecycleValueDto(v.SourceValue, v.Meaning, v.Origin, v.OccurrenceCount)).ToList(),
            InferManagerKind(derived),
            derived.Readiness,
            semanticState,
            derived.Cells.Take(MatchPreviewRowLimit).Select(row => (IReadOnlyList<string?>)row.ToList()).ToList());
    }

    /// <summary>What the file's manager values are. A name is reported as unrecognized: it is never an automatic identity.</summary>
    private static WorkforceReferenceKind InferManagerKind(WorkforceImportMatchState derived)
    {
        var rows = derived.Interpretation.Rows;
        if (rows.Any(r => !string.IsNullOrWhiteSpace(r.FusionManagerReference))) return WorkforceReferenceKind.FusionId;
        if (rows.Any(r => !string.IsNullOrWhiteSpace(r.ManagerKey))) return WorkforceReferenceKind.WorkerReference;
        var values = rows.Select(r => r.ManagerReference).Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => v!.Trim()).ToList();
        if (values.Count == 0) return WorkforceReferenceKind.None;
        var numbers = rows.Select(r => r.EmployeeNumber).Where(v => !string.IsNullOrWhiteSpace(v))
            .Select(v => WorkforceCanonicalSnapshot.NormalizeNumber(v!)).ToHashSet(StringComparer.Ordinal);
        var byNumber = values.Count(v => numbers.Contains(WorkforceCanonicalSnapshot.NormalizeNumber(v)));
        var byEmail = values.Count(v => v.Contains('@'));
        if (byNumber >= byEmail && byNumber > 0) return WorkforceReferenceKind.EmployeeNumber;
        if (byEmail > 0) return WorkforceReferenceKind.Email;
        return WorkforceReferenceKind.Unrecognized;
    }

    private async Task<WorkforceImportSession> LoadSessionAsync(Guid sessionId, uint ifMatchVersion, CancellationToken cancellationToken)
    {
        var session = await context.WorkforceImportSessions.Include(s => s.Source)
            .SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken)
            ?? throw new WorkforceImportNotFoundException(sessionId);
        if (session.Version != ifMatchVersion) throw new WorkforceImportConcurrencyException(sessionId);
        if (!session.IsActive) throw new WorkforceImportReviewException("This import is finished.", "ImportTerminal");
        if (session.IsPublishing) throw new WorkforceImportReviewException("This import is being published.", "ImportPublishing");
        return session;
    }

    private async Task SaveAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new WorkforceImportConcurrencyException(sessionId); }
    }

    /// <summary>A search hint from an unresolved reference: an email's local part or the last name-ish token.</summary>
    private static string DeriveNameHint(string reference)
    {
        var value = reference.Trim();
        var at = value.IndexOf('@');
        if (at > 0) value = value[..at];
        var tokens = value.Split(['.', '_', '-', ' '], StringSplitOptions.RemoveEmptyEntries);
        return tokens.Length > 0 ? tokens[^1] : value;
    }

    private static string EscapeLike(string value)
        => value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}
