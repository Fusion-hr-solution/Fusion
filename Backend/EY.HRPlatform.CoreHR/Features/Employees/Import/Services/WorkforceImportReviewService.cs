using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

// ---- Product-facing review contracts (never persistence entities) ----

public sealed record WorkforceReviewEmployeeDto(string DisplayName, string? EmployeeNumber, bool NumberGenerated, string IdentityState);
public sealed record WorkforceReviewEmploymentDto(DateOnly? StartDate);
public sealed record WorkforceReviewWorkDto(string? DisplayTitle, string? Organization, string? Location, DateOnly? EffectiveFrom);
public sealed record WorkforceReviewManagerDto(string State, string? Display, string? Subtext);
public sealed record WorkforceReviewIssueDto(string Code, string Severity, string Message, string Field, string? DecisionKey, int AffectedCount);

public sealed record WorkforceReviewRowDto(
    int SourceRowNumber,
    string Result,
    WorkforceReviewEmployeeDto Employee,
    WorkforceReviewEmploymentDto Employment,
    WorkforceReviewWorkDto Work,
    WorkforceReviewManagerDto Manager,
    IReadOnlyList<WorkforceReviewIssueDto> Issues);

public sealed record WorkforceReviewCountsDto(int NeedsAttention, int New, int Existing, int Excluded, int Total, int OpenIssueCount);

/// <summary>
/// One kind of outstanding decision, so the review can say what the remaining work *is* — "3 organizations
/// to match · 40 people" — instead of a single alarming affected-people total. <c>Category</c> is a stable
/// key the client maps to product language; <c>DecisionCount</c> is grouped (shared values counted once),
/// <c>AffectedPeople</c> is how many rows the category touches.
/// </summary>
public sealed record WorkforceReviewIssueGroupDto(string Category, int DecisionCount, int AffectedPeople);

/// <summary>The distinct product states the review can be in — the frontend never infers these from counters.</summary>
public enum WorkforceReviewState { NoRows, NothingNew, NothingIncluded, Reviewable }

public sealed record WorkforceReviewSummaryDto(
    WorkforceReviewCountsDto Counts, bool CanCommit, WorkforceReviewState State, uint Version, string? ReviewDigest, int AffectedRows,
    IReadOnlyList<WorkforceReviewIssueGroupDto> IssueGroups);

public sealed record WorkforceReviewPageDto(
    IReadOnlyList<WorkforceReviewRowDto> Rows, int Page, int PageSize, int TotalMatching, WorkforceReviewSummaryDto Summary);

/// <summary>A person being added in this same import, offered as a candidate manager.</summary>
public sealed record WorkforceManagerCandidateDto(int SourceRowNumber, string DisplayName, string? EmployeeNumber, bool NumberGenerated, string? Title);

public sealed record WorkforceColumnMappingDto(int ColumnIndex, string? SourceLabel, string Field, string Origin);
public sealed record WorkforceInterpretationSummaryDto(
    IReadOnlyList<WorkforceColumnMappingDto> Mappings,
    IReadOnlyList<int> UnresolvedColumnIndexes,
    IReadOnlyList<string> UnresolvedRequiredFields,
    bool NameFormatDecisionNeeded,
    bool DateFormatDecisionNeeded);
public sealed record WorkforcePrepareResultDto(WorkforceInterpretationSummaryDto Interpretation, WorkforceReviewSummaryDto Review);

public sealed class WorkforceImportReviewException(string message) : Exception(message);

/// <summary>Parsed session decisions (interpretation + resolution), persisted as one bounded jsonb document.</summary>
public sealed class WorkforceImportDecisionDoc
{
    public Dictionary<int, string> ColumnMappings { get; set; } = [];
    public string? DateFormat { get; set; }
    public string? NameFormat { get; set; }
    public int? HeaderRow { get; set; }
    public HashSet<int> ExcludedRows { get; set; } = [];
    public HashSet<int> KeepFusionUnchangedRows { get; set; } = [];
    public HashSet<int> NoManagerRows { get; set; } = [];
    public HashSet<int> KeepAsDistinctRows { get; set; } = [];
    public Dictionary<string, Guid> OrganizationBySourceValue { get; set; } = [];
    public Dictionary<int, Guid> ManagerEmployeeByRow { get; set; } = [];
    // Reference-scoped manager decisions (normalized manager reference → resolution), so one choice
    // resolves every row reporting to that manager.
    public Dictionary<string, Guid> ManagerEmployeeByReference { get; set; } = [];
    public Dictionary<string, int> ManagerImportRowByReference { get; set; } = [];
    public HashSet<string> NoManagerByReference { get; set; } = [];

    /// <summary>
    /// The administrator explicitly chose to establish current work details (and the initial manager
    /// relationship) as of the import baseline for people whose source work dates predate their
    /// Organization's history in Fusion. Auditable, never silent.
    /// </summary>
    public bool NormalizeWorkDatesToBaseline { get; set; }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static WorkforceImportDecisionDoc Parse(string json)
        => string.IsNullOrWhiteSpace(json) || json == "{}" ? new() : JsonSerializer.Deserialize<WorkforceImportDecisionDoc>(json, Json) ?? new();

    public string Serialize() => JsonSerializer.Serialize(this, Json);

    public WorkforceImportInterpretation ToInterpretation() => new(
        ColumnMappings.ToDictionary(kv => kv.Key, kv => Enum.Parse<WorkforceImportField>(kv.Value)),
        NameFormat is null ? null : Enum.Parse<WorkforceNameFormat>(NameFormat),
        DateFormat is null ? null : Enum.Parse<WorkforceDateFormat>(DateFormat));

    public WorkforceResolutionDecisions ToResolutionDecisions() => new(
        ExcludedRows, KeepFusionUnchangedRows, NoManagerRows, KeepAsDistinctRows, OrganizationBySourceValue, ManagerEmployeeByRow,
        ManagerEmployeeByReference, ManagerImportRowByReference, NoManagerByReference,
        NormalizeWorkDatesToBaseline);
}

/// <summary>
/// Composes persisted source/rows + decisions + a live canonical snapshot + interpreter + resolver
/// into a stable, pageable, actionable review. The full proposal is recomputed once over all rows
/// (bounded), and each row's classification + display projection + issues are persisted so paging,
/// filtering, search, and counts never re-run the resolver or load all rows for one page.
/// </summary>
public sealed class WorkforceImportReviewService(
    CoreHRDbContext context,
    ITenantContext tenant,
    WorkforceImportInterpreter interpreter,
    WorkforceImportResolver resolver,
    WorkforceImportSnapshotLoader snapshotLoader)
{
    private Guid TenantId => tenant.TenantId;
    private const int MaxPageSize = 100;

    /// <summary>Resolve a public stable Employee Key to its canonical id (raw GUIDs are never public).</summary>
    public Task<Guid?> ResolveEmployeeKeyAsync(string employeeKey, CancellationToken cancellationToken)
        => context.Employees.AsNoTracking()
            .Where(e => e.StableEmployeeKey == employeeKey)
            .Select(e => (Guid?)e.Id)
            .SingleOrDefaultAsync(cancellationToken);

    /// <summary>Apply a decision mutation, recompute, and persist under If-Match; returns the new summary.</summary>
    public async Task<WorkforceReviewSummaryDto> ApplyDecisionAsync(
        Guid sessionId, uint ifMatchVersion, Action<WorkforceImportDecisionDoc> mutate, WorkforceImportActor actor, CancellationToken cancellationToken)
    {
        var session = await LoadSessionAsync(sessionId, cancellationToken);
        if (session.Version != ifMatchVersion) throw new WorkforceImportConcurrencyException(sessionId);

        var doc = WorkforceImportDecisionDoc.Parse(session.DecisionsJson);
        var before = (session.NewCount, session.ExistingAnchorCount, session.NeedsAttentionCount, session.ExcludedCount);
        mutate(doc);
        session.ReplaceDecisions(doc.Serialize(), actor);

        var (affected, _) = await RecomputeAsync(session, cancellationToken);
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new WorkforceImportConcurrencyException(sessionId); }
        return Summarize(session, affected, await ComputeOpenIssuesAsync(sessionId, cancellationToken));
    }

    /// <summary>Recompute the whole proposal and persist row projections without a decision change (e.g. after intake/header/baseline).</summary>
    public async Task<WorkforceReviewSummaryDto> RecomputeAndSaveAsync(Guid sessionId, uint ifMatchVersion, WorkforceImportActor actor, CancellationToken cancellationToken)
    {
        var session = await LoadSessionAsync(sessionId, cancellationToken);
        if (session.Version != ifMatchVersion) throw new WorkforceImportConcurrencyException(sessionId);
        var (affected, _) = await RecomputeAsync(session, cancellationToken);
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new WorkforceImportConcurrencyException(sessionId); }
        return Summarize(session, affected, await ComputeOpenIssuesAsync(sessionId, cancellationToken));
    }

    /// <summary>Recompute and return both the (mostly quiet) interpretation summary and the review summary — the "Preparing workforce" step.</summary>
    public async Task<WorkforcePrepareResultDto> PrepareAsync(Guid sessionId, uint ifMatchVersion, WorkforceImportActor actor, CancellationToken cancellationToken)
    {
        var session = await LoadSessionAsync(sessionId, cancellationToken);
        if (session.Version != ifMatchVersion) throw new WorkforceImportConcurrencyException(sessionId);
        var (affected, interpretation) = await RecomputeAsync(session, cancellationToken);
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new WorkforceImportConcurrencyException(sessionId); }
        var summary = new WorkforceInterpretationSummaryDto(
            interpretation.Mappings.Select(m => new WorkforceColumnMappingDto(m.ColumnIndex, m.Label, m.Field.ToString(), m.Origin)).ToList(),
            interpretation.Mappings.Where(m => m.Origin == "unresolved").Select(m => m.ColumnIndex).ToList(),
            interpretation.UnresolvedRequiredFields.Select(f => f.ToString()).ToList(),
            interpretation.NameFormatDecisionNeeded,
            interpretation.DateFormatDecisionNeeded);
        return new WorkforcePrepareResultDto(summary, Summarize(session, affected, await ComputeOpenIssuesAsync(sessionId, cancellationToken)));
    }

    private async Task<(int Affected, WorkforceInterpretationResult Interpretation)> RecomputeAsync(WorkforceImportSession session, CancellationToken cancellationToken)
    {
        var rows = await context.WorkforceImportRows.Where(r => r.SessionId == session.Id).OrderBy(r => r.SourceRowNumber).ToListAsync(cancellationToken);
        var columns = Deserialize(session.Source.ColumnsJson) ?? [];
        var doc = WorkforceImportDecisionDoc.Parse(session.DecisionsJson);

        var cells = rows.Select(r => (IReadOnlyList<string?>)(Deserialize(r.SourceCellsJson) ?? [])).ToList();
        var interpretation = interpreter.Interpret(columns, cells, doc.ToInterpretation(), session.BaselineDate);
        var snapshot = await snapshotLoader.LoadAsync(session.BaselineDate, cancellationToken);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var proposal = resolver.Resolve(interpretation.Rows, snapshot, doc.ToResolutionDecisions(), session.BaselineDate, today);

        var normalizedByRow = interpretation.Rows.ToDictionary(r => r.SourceRowNumber);
        // How many rows each grouped decision key affects, so the inspector can say
        // "Operations appears on 38 employees" and one decision resolves them all.
        var affectedByKey = proposal.Rows
            .SelectMany(r => r.Issues.Where(i => i.DecisionKey is not null).Select(i => i.DecisionKey!))
            .GroupBy(k => k)
            .ToDictionary(g => g.Key, g => g.Count());
        // Names of every same-import row, so a manager referencing another imported row shows
        // as a person ("Amina Mansour · also being added") rather than a raw source key.
        var nameByRow = normalizedByRow.ToDictionary(kv => kv.Key, kv => JoinName(kv.Value.FirstName, kv.Value.LastName));
        var affected = 0;
        var rowByNumber = rows.ToDictionary(r => r.SourceRowNumber);
        foreach (var resolvedRow in proposal.Rows)
        {
            if (!rowByNumber.TryGetValue(resolvedRow.SourceRowNumber, out var row)) continue;
            var projection = BuildProjection(resolvedRow, normalizedByRow.GetValueOrDefault(resolvedRow.SourceRowNumber), nameByRow, snapshot);
            var issues = resolvedRow.Issues
                .Where(i => i.Severity != Severities.Information || i.Code != "EmployeeNumberGenerated") // generated number stays quiet display state
                .Select(i => new WorkforceReviewIssueDto(i.Code, i.Severity, i.Message, i.Field, i.DecisionKey,
                    i.DecisionKey is not null ? affectedByKey.GetValueOrDefault(i.DecisionKey, 1) : 1)).ToList();
            row.ApplyResolution(resolvedRow.Classification, resolvedRow.MatchedEmployeeId, resolvedRow.ResolvedOrgUnitId,
                resolvedRow.Manager.RawReference, resolvedRow.IsExcluded,
                JsonSerializer.Serialize(projection), JsonSerializer.Serialize(issues));
            affected++;
        }

        var reviewDigest = ComputeDigest(session.BaselineDate, session.DecisionsJson, proposal);
        var observationDigest = ComputeObservationDigest(snapshot, proposal);
        session.MoveToReviewing(proposal.NewCount, proposal.ExistingAnchorCount, proposal.NeedsAttentionCount, proposal.ExcludedCount,
            reviewDigest, observationDigest, ActorFrom(session));
        return (affected, interpretation);
    }

    public async Task<WorkforceReviewPageDto> GetReviewPageAsync(
        Guid sessionId, string? filter, string? search, int page, int pageSize, CancellationToken cancellationToken)
    {
        var session = await LoadSessionAsync(sessionId, cancellationToken);
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        // Bounded server-side query over persisted row projections — no full 10k materialization.
        var query = context.WorkforceImportRows.AsNoTracking().Where(r => r.SessionId == sessionId);
        if (Enum.TryParse<WorkforceImportRowClassification>(filter, ignoreCase: true, out var classification))
            query = query.Where(r => r.Classification == classification);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(r => r.NormalizedProposalJson != null && EF.Functions.ILike(r.NormalizedProposalJson, $"%{term}%"));
        }

        var total = await query.CountAsync(cancellationToken);
        var pageRows = await query.OrderBy(r => r.SourceRowNumber)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);

        var rows = pageRows.Select(ToRowDto).ToList();
        var openIssues = await ComputeOpenIssuesAsync(sessionId, cancellationToken);
        return new WorkforceReviewPageDto(rows, page, pageSize, total, Summarize(session, 0, openIssues));
    }

    /// <summary>
    /// People in THIS import who could be the manager — because in an establishment import the manager
    /// is usually also being added, not already in Fusion. With no query, we search on a name hint
    /// derived from the unresolved reference (the surname-ish token, or an email's local part) so likely
    /// matches surface first; a typed query searches by name/number. Existing employees are offered
    /// separately by the People search on the client.
    /// </summary>
    public async Task<IReadOnlyList<WorkforceManagerCandidateDto>> GetImportManagerCandidatesAsync(
        Guid sessionId, string? reference, string? query, CancellationToken cancellationToken)
    {
        var term = (query ?? string.Empty).Trim();
        if (term.Length == 0 && !string.IsNullOrWhiteSpace(reference)) term = DeriveNameHint(reference);
        var folded = term.ToLowerInvariant();

        // The candidate pool is one import session (bounded), and the searchable name lives inside a jsonb
        // projection — which Postgres won't ILIKE directly — so match on the deserialized display name in
        // memory. Ordered by source row; capped at the few the picker shows.
        var rows = await context.WorkforceImportRows.AsNoTracking()
            .Where(r => r.SessionId == sessionId && r.Classification != WorkforceImportRowClassification.Excluded)
            .OrderBy(r => r.SourceRowNumber)
            .Select(r => new { r.SourceRowNumber, r.NormalizedProposalJson })
            .ToListAsync(cancellationToken);

        var results = new List<WorkforceManagerCandidateDto>();
        foreach (var r in rows)
        {
            if (r.NormalizedProposalJson is null) continue;
            var p = JsonSerializer.Deserialize<ReviewProjection>(r.NormalizedProposalJson) ?? new ReviewProjection();
            if (folded.Length > 0 && !p.DisplayName.ToLowerInvariant().Contains(folded)) continue;
            results.Add(new WorkforceManagerCandidateDto(r.SourceRowNumber, p.DisplayName, p.EmployeeNumber, p.NumberGenerated, p.DisplayTitle));
            if (results.Count >= 8) break;
        }
        return results;
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

    private WorkforceReviewRowDto ToRowDto(WorkforceImportRow row)
    {
        var projection = row.NormalizedProposalJson is null
            ? new ReviewProjection()
            : JsonSerializer.Deserialize<ReviewProjection>(row.NormalizedProposalJson) ?? new ReviewProjection();
        var issues = row.IssueStateJson is null ? [] : JsonSerializer.Deserialize<List<WorkforceReviewIssueDto>>(row.IssueStateJson) ?? [];
        return new WorkforceReviewRowDto(
            row.SourceRowNumber,
            ResultLabel(row.Classification),
            new WorkforceReviewEmployeeDto(projection.DisplayName, projection.EmployeeNumber, projection.NumberGenerated, projection.IdentityState),
            new WorkforceReviewEmploymentDto(projection.StartDate),
            new WorkforceReviewWorkDto(projection.DisplayTitle, projection.Organization, projection.Location, projection.EffectiveFrom),
            new WorkforceReviewManagerDto(projection.ManagerState, projection.ManagerDisplay, projection.ManagerSubtext),
            issues);
    }

    private static string JoinName(string? first, string? last)
        => string.Join(' ', new[] { first, last }.Where(s => !string.IsNullOrWhiteSpace(s)));

    private static ReviewProjection BuildProjection(
        ResolvedWorkforceRow resolved, NormalizedWorkforceRow? normalized,
        IReadOnlyDictionary<int, string> nameByRow, WorkforceCanonicalSnapshot snapshot)
    {
        var name = JoinName(normalized?.FirstName, normalized?.LastName);
        var (managerState, managerDisplay, managerSubtext) = ResolveManagerDisplay(resolved.Manager, nameByRow, snapshot);
        return new ReviewProjection
        {
            DisplayName = string.IsNullOrWhiteSpace(name) ? "(unnamed)" : name,
            EmployeeNumber = string.IsNullOrWhiteSpace(normalized?.EmployeeNumber) ? null : normalized!.EmployeeNumber,
            NumberGenerated = resolved.Classification == WorkforceImportRowClassification.NewEmployee && string.IsNullOrWhiteSpace(normalized?.EmployeeNumber),
            IdentityState = resolved.MatchedEmployeeId is not null ? "Existing" : "New",
            StartDate = normalized?.EmploymentStart,
            DisplayTitle = normalized?.DisplayTitle,
            Organization = normalized?.OrganizationRef,
            Location = normalized?.Location,
            EffectiveFrom = resolved.ResolvedWorkEffectiveDate,
            ManagerState = managerState,
            ManagerDisplay = managerDisplay,
            ManagerSubtext = managerSubtext,
        };
    }

    /// <summary>Turn a resolved manager into the person the reviewer should see, not the raw source key.</summary>
    private static (string State, string? Display, string? Subtext) ResolveManagerDisplay(
        ResolvedManager manager, IReadOnlyDictionary<int, string> nameByRow, WorkforceCanonicalSnapshot snapshot)
    {
        switch (manager.Kind)
        {
            case ManagerResolutionKind.None:
                return ("NoManager", null, null);
            case ManagerResolutionKind.Unresolved:
                // Show what the file said so the reviewer can recognise the value to fix.
                return ("Unresolved", manager.RawReference, null);
            case ManagerResolutionKind.SameImportRow:
                var importedName = manager.SameImportSourceRowNumber is int rn ? nameByRow.GetValueOrDefault(rn) : null;
                return ("Resolved", string.IsNullOrWhiteSpace(importedName) ? manager.RawReference : importedName, "Also being added");
            case ManagerResolutionKind.ExistingEmployee:
                var existingName = manager.EmployeeId is Guid id && snapshot.ByFusionId.TryGetValue(id, out var e)
                    ? JoinName(e.FirstName, e.LastName) : null;
                return ("Resolved", string.IsNullOrWhiteSpace(existingName) ? manager.RawReference : existingName, null);
            default:
                return ("NoManager", null, null);
        }
    }

    private WorkforceReviewSummaryDto Summarize(
        WorkforceImportSession session, int affected,
        (int OpenIssueCount, IReadOnlyList<WorkforceReviewIssueGroupDto> Groups) issues)
    {
        var counts = new WorkforceReviewCountsDto(session.NeedsAttentionCount, session.NewCount, session.ExistingAnchorCount, session.ExcludedCount,
            session.NewCount + session.ExistingAnchorCount + session.NeedsAttentionCount + session.ExcludedCount, issues.OpenIssueCount);
        var state = counts.Total == 0 ? WorkforceReviewState.NoRows
            : session.NewCount == 0 && session.ExistingAnchorCount > 0 && session.NeedsAttentionCount == 0 ? WorkforceReviewState.NothingNew
            : session.NewCount == 0 && session.NeedsAttentionCount == 0 ? WorkforceReviewState.NothingIncluded
            : WorkforceReviewState.Reviewable;
        var canCommit = session.NeedsAttentionCount == 0 && session.NewCount > 0;
        return new WorkforceReviewSummaryDto(counts, canCommit, state, session.Version, session.ReviewDigest, affected, issues.Groups);
    }

    /// <summary>Stable category key for a blocker, so the review can name the *kind* of remaining work.</summary>
    private static string IssueCategory(string code) => code switch
    {
        "OrganizationUnresolved" or "OrganizationInvalidToday" or "OrganizationMissing" or "FusionOrganizationReferenceUnresolved" => "organization",
        "WorkDatePrecedesOrganizationHistory" => "workdate",
        "ManagerUnresolved" or "SelfManager" or "ManagerCycle" => "manager",
        "UnsupportedExistingDifference" => "difference",
        "FormerWorkerNotEstablished" or "EmploymentEndedBeforeToday" or "EmploymentStartAfterBaseline" or "FormerEmployeeLifecycleConflict" => "lifecycle",
        "NameMissing" or "DisplayTitleMissing" or "EmploymentStartMissing" or "DateUnparseable" => "data",
        _ => "identity",
    };

    /// <summary>
    /// The distinct decisions the reviewer still has to make — not the number of affected rows — plus a
    /// per-category breakdown so the review can say what the work *is* ("3 organizations to match · 40
    /// people") instead of one alarming total. Grouped decisions (an ambiguous Organization value, an
    /// unresolved manager reference) each count once no matter how many employees they touch; a
    /// row-specific blocker counts once per row. Bounded: only rows still needing attention carry blockers.
    /// </summary>
    private async Task<(int OpenIssueCount, IReadOnlyList<WorkforceReviewIssueGroupDto> Groups)> ComputeOpenIssuesAsync(
        Guid sessionId, CancellationToken cancellationToken)
    {
        var jsons = await context.WorkforceImportRows.AsNoTracking()
            .Where(r => r.SessionId == sessionId && r.Classification == WorkforceImportRowClassification.NeedsAttention)
            .Select(r => r.IssueStateJson)
            .ToListAsync(cancellationToken);

        // Per category: distinct grouped decision keys, count of rows carrying a row-specific blocker,
        // and how many people the category touches.
        var catGroupedKeys = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        var catRowSpecific = new Dictionary<string, int>(StringComparer.Ordinal);
        var catPeople = new Dictionary<string, int>(StringComparer.Ordinal);

        foreach (var json in jsons)
        {
            if (json is null) continue;
            var issues = JsonSerializer.Deserialize<List<WorkforceReviewIssueDto>>(json) ?? [];
            var blockers = issues.Where(i => i.Severity == Severities.Blocker).ToList();
            if (blockers.Count == 0) continue;

            var categoriesOnRow = new HashSet<string>(StringComparer.Ordinal);
            foreach (var b in blockers)
            {
                var cat = IssueCategory(b.Code);
                categoriesOnRow.Add(cat);
                if (b.DecisionKey is not null)
                {
                    if (!catGroupedKeys.TryGetValue(cat, out var set)) catGroupedKeys[cat] = set = new(StringComparer.Ordinal);
                    set.Add(b.DecisionKey);
                }
            }
            foreach (var cat in categoriesOnRow)
            {
                catPeople[cat] = catPeople.GetValueOrDefault(cat) + 1;
                if (blockers.Any(b => b.DecisionKey is null && IssueCategory(b.Code) == cat))
                    catRowSpecific[cat] = catRowSpecific.GetValueOrDefault(cat) + 1;
            }
        }

        int decisionCount(string cat) => (catGroupedKeys.GetValueOrDefault(cat)?.Count ?? 0) + catRowSpecific.GetValueOrDefault(cat);
        var order = new[] { "organization", "workdate", "manager", "difference", "identity", "lifecycle", "data" };
        var groups = order
            .Where(catPeople.ContainsKey)
            .Select(cat => new WorkforceReviewIssueGroupDto(cat, decisionCount(cat), catPeople[cat]))
            .ToList();
        // The headline total is the sum of the visible category counts, so hero, footer, and the
        // breakdown chips can never disagree.
        return (groups.Sum(g => g.DecisionCount), groups);
    }

    private async Task<WorkforceImportSession> LoadSessionAsync(Guid sessionId, CancellationToken cancellationToken)
        => await context.WorkforceImportSessions.Include(s => s.Source)
            .SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken)
            ?? throw new WorkforceImportReviewException($"Workforce Import session {sessionId} was not found.");

    private static WorkforceImportActor ActorFrom(WorkforceImportSession session) => new(session.LastUpdatedByUserId, session.LastUpdatedByDisplayName);

    private static string ResultLabel(WorkforceImportRowClassification c) => c switch
    {
        WorkforceImportRowClassification.NewEmployee => "New",
        WorkforceImportRowClassification.ExistingAnchor => "Existing",
        WorkforceImportRowClassification.Excluded => "Excluded",
        _ => "NeedsAttention",
    };

    private static List<string?>? Deserialize(string? json)
        => json is null ? null : JsonSerializer.Deserialize<List<string?>>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web));

    private static string ComputeDigest(DateOnly baseline, string decisionsJson, WorkforceImportProposal proposal)
    {
        var meaning = new StringBuilder().Append(baseline).Append('|').Append(decisionsJson);
        foreach (var row in proposal.Rows.OrderBy(r => r.SourceRowNumber))
            meaning.Append('|').Append(row.SourceRowNumber).Append(':').Append(row.Classification).Append(':')
                .Append(row.MatchedEmployeeId).Append(':').Append(row.ResolvedOrgUnitId).Append(':').Append(row.Manager.Kind)
                .Append(':').Append(row.HasBlocker);
        return Hash(meaning.ToString());
    }

    private static string ComputeObservationDigest(WorkforceCanonicalSnapshot snapshot, WorkforceImportProposal proposal)
    {
        // Only referenced canonical facts — matched employees, referenced OrgUnits, work-email occupancy.
        var referenced = new StringBuilder();
        foreach (var employeeId in proposal.Rows.Where(r => r.MatchedEmployeeId is not null).Select(r => r.MatchedEmployeeId!.Value).Distinct().OrderBy(x => x))
            referenced.Append("e:").Append(employeeId).Append(snapshot.ByFusionId.TryGetValue(employeeId, out var e) ? e.IsFormer : false).Append('|');
        foreach (var orgId in proposal.Rows.Where(r => r.ResolvedOrgUnitId is not null).Select(r => r.ResolvedOrgUnitId!.Value).Distinct().OrderBy(x => x))
            referenced.Append("o:").Append(orgId).Append(snapshot.OrgById.TryGetValue(orgId, out var o) && o.ValidToday).Append('|');
        return Hash(referenced.ToString());
    }

    private static string Hash(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)))[..64];

    private sealed class ReviewProjection
    {
        public string DisplayName { get; set; } = "(unnamed)";
        public string? EmployeeNumber { get; set; }
        public bool NumberGenerated { get; set; }
        public string IdentityState { get; set; } = "New";
        public DateOnly? StartDate { get; set; }
        public string? DisplayTitle { get; set; }
        public string? Organization { get; set; }
        public string? Location { get; set; }
        public DateOnly? EffectiveFrom { get; set; }
        public string ManagerState { get; set; } = "NoManager";
        public string? ManagerDisplay { get; set; }
        public string? ManagerSubtext { get; set; }
    }
}
