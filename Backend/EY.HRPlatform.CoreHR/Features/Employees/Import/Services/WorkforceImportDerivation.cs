using System.Text.Json;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

/// <summary>What the source means under the current Match plan: enough for Match and semantic assistance.</summary>
public sealed record WorkforceImportMatchState(
    WorkforceImportMappingPlan Plan,
    IReadOnlyList<string?> Columns,
    IReadOnlyList<IReadOnlyList<string?>> Cells,
    WorkforceInterpretationResult Interpretation,
    WorkforceMatchReadinessDto Readiness,
    bool TenantHasEmployees);

/// <summary>Everything derived from one attempt's source, Match plan, Review resolutions and current CoreHR.</summary>
public sealed record WorkforceImportDerived(
    WorkforceImportMappingPlan Plan,
    WorkforceImportResolutions Resolutions,
    IReadOnlyList<string?> Columns,
    IReadOnlyList<IReadOnlyList<string?>> Cells,
    WorkforceInterpretationResult Interpretation,
    WorkforceMatchReadinessDto Readiness,
    WorkforceCanonicalSnapshot Snapshot,
    WorkforceImportProposal Proposal,
    string ProposalFingerprint)
{
    public WorkforceImportMatchState Match => new(Plan, Columns, Cells, Interpretation, Readiness, Snapshot.HasEmployees);
}

/// <summary>
/// The one derivation chain: source → Match plan → deterministic interpretation → canonical
/// workforce proposal (identity, OrgUnit, manager) → validation → proposal fingerprint. Review,
/// semantic assistance and publication all derive through here, so what the administrator reviews
/// is exactly what publication re-derives and compares.
/// </summary>
public sealed class WorkforceImportDerivation(
    CoreHRDbContext context,
    WorkforceImportInterpreter interpreter,
    WorkforceImportResolver resolver,
    WorkforceImportSnapshotLoader snapshotLoader)
{
    private static readonly JsonSerializerOptions CellJson = new(JsonSerializerDefaults.Web);

    /// <summary>Interprets the source under the Match plan without resolving it against CoreHR.</summary>
    public async Task<WorkforceImportMatchState> InterpretAsync(
        WorkforceImportSession session,
        IReadOnlyList<WorkforceImportRow> rows,
        CancellationToken cancellationToken)
    {
        var plan = WorkforceImportMappingPlan.Parse(session.MappingPlanJson);
        var columns = DeserializeCells(session.Source.ColumnsJson) ?? [];
        var cells = rows.OrderBy(r => r.SourceRowNumber)
            .Select(r => (IReadOnlyList<string?>)(DeserializeCells(r.SourceCellsJson) ?? []))
            .ToList();
        var interpretation = interpreter.Interpret(columns, cells, plan.ToInterpretation(), session.BaselineDate);
        var hasEmployees = await context.Employees.AsNoTracking().AnyAsync(cancellationToken);
        var readiness = WorkforceImportMatchReadiness.Evaluate(interpretation, plan, hasEmployees);
        return new WorkforceImportMatchState(plan, columns, cells, interpretation, readiness, hasEmployees);
    }

    public async Task<WorkforceImportDerived> DeriveAsync(
        WorkforceImportSession session,
        IReadOnlyList<WorkforceImportRow> rows,
        CancellationToken cancellationToken,
        WorkforceImportMappingPlan? plan = null,
        WorkforceImportResolutions? resolutions = null)
    {
        plan ??= WorkforceImportMappingPlan.Parse(session.MappingPlanJson);
        resolutions ??= WorkforceImportResolutions.Parse(session.ResolutionsJson);
        var columns = DeserializeCells(session.Source.ColumnsJson) ?? [];
        var cells = rows.OrderBy(r => r.SourceRowNumber)
            .Select(r => (IReadOnlyList<string?>)(DeserializeCells(r.SourceCellsJson) ?? []))
            .ToList();
        var interpretation = interpreter.Interpret(columns, cells, plan.ToInterpretation(), session.BaselineDate);
        var snapshot = await snapshotLoader.LoadAsync(session.BaselineDate, cancellationToken);
        var readiness = WorkforceImportMatchReadiness.Evaluate(interpretation, plan, snapshot.HasEmployees);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var proposal = resolver.Resolve(interpretation.Rows, snapshot, resolutions.ToResolutionDecisions(), session.BaselineDate, today);
        var fingerprint = Fingerprint(session.BaselineDate, readiness.CanContinue, interpretation, proposal);
        return new WorkforceImportDerived(plan, resolutions, columns, cells, interpretation, readiness, snapshot, proposal, fingerprint);
    }

    /// <summary>Loads the attempt's rows (tracked), derives, and persists the row projections and proposal summary.</summary>
    public async Task<WorkforceImportDerived> RecomputeAsync(WorkforceImportSession session, CancellationToken cancellationToken)
    {
        var rows = await context.WorkforceImportRows.Where(r => r.SessionId == session.Id).OrderBy(r => r.SourceRowNumber).ToListAsync(cancellationToken);
        var derived = await DeriveAsync(session, rows, cancellationToken);
        WorkforceImportProjection.Persist(rows, derived);
        session.RecordProposal(
            derived.Proposal.CreateCount,
            derived.Proposal.ExistingCount,
            derived.Proposal.BlockedCount,
            derived.Proposal.NotImportedCount,
            derived.Proposal.WarningCount,
            derived.Readiness.CanContinue,
            derived.ProposalFingerprint);
        return derived;
    }

    /// <summary>
    /// Deterministic identity of every publication-relevant fact: the as-of date, Match completeness,
    /// and for each row its classification, identity, canonical fields, OrgUnit and manager target.
    /// Any change to what publication would write changes the fingerprint.
    /// </summary>
    public static string Fingerprint(DateOnly baseline, bool matchComplete, WorkforceInterpretationResult interpretation, WorkforceImportProposal proposal)
    {
        var normalizedByRow = interpretation.Rows.ToDictionary(r => r.SourceRowNumber);
        var rows = proposal.Rows.OrderBy(r => r.SourceRowNumber).Select(r =>
        {
            var n = normalizedByRow.GetValueOrDefault(r.SourceRowNumber);
            return new
            {
                row = r.SourceRowNumber,
                classification = r.Classification.ToString(),
                existing = r.MatchedEmployeeId,
                number = string.IsNullOrWhiteSpace(n?.EmployeeNumber) ? "generated" : WorkforceCanonicalSnapshot.NormalizeNumber(n.EmployeeNumber),
                first = n?.FirstName,
                last = n?.LastName,
                preferred = n?.PreferredName,
                email = string.IsNullOrWhiteSpace(n?.WorkEmail) ? null : WorkforceCanonicalSnapshot.NormalizeEmail(n.WorkEmail),
                start = n?.EmploymentStart,
                workFrom = r.ResolvedWorkEffectiveDate,
                orgUnit = r.ResolvedOrgUnitId,
                title = n?.DisplayTitle,
                location = n?.Location,
                manager = r.Manager.Kind switch
                {
                    ManagerResolutionKind.ExistingEmployee => $"existing:{r.Manager.EmployeeId}",
                    ManagerResolutionKind.SameImportRow => $"row:{r.Manager.SameImportSourceRowNumber}",
                    ManagerResolutionKind.Unresolved => "unresolved",
                    _ => "none",
                },
                blocked = r.HasBlocker,
            };
        }).ToList();
        return ImportFingerprint.HashCanonical(new { baseline, matchComplete, rows });
    }

    internal static List<string?>? DeserializeCells(string? json)
        => json is null ? null : JsonSerializer.Deserialize<List<string?>>(json, CellJson);
}
