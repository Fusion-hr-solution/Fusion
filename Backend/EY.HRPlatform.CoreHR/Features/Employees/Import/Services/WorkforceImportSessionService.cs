using System.Security.Cryptography;
using System.Text;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

public interface IWorkforceImportSessionService
{
    Task<WorkforceImportIntakeOutcome> IntakeAsync(WorkforceImportIntakeRequest request, CancellationToken cancellationToken);
    Task<WorkforceImportSession?> GetAsync(Guid sessionId, CancellationToken cancellationToken);
    Task<WorkforceImportSession?> GetActiveAsync(CancellationToken cancellationToken);
    Task<WorkforceImportSession> SelectHeaderRowAsync(Guid sessionId, int headerRowIndex, uint ifMatchVersion, WorkforceImportActor actor, CancellationToken cancellationToken);
    Task<WorkforceImportSession> ReplaceDecisionsAsync(Guid sessionId, string decisionsJson, uint ifMatchVersion, WorkforceImportActor actor, CancellationToken cancellationToken);
    Task<WorkforceImportSession> ChangeBaselineDateAsync(Guid sessionId, DateOnly baselineDate, uint ifMatchVersion, WorkforceImportActor actor, CancellationToken cancellationToken);
    Task<WorkforceImportSession> ReplaceSourceAsync(Guid sessionId, WorkforceImportReplaceSourceRequest request, uint ifMatchVersion, CancellationToken cancellationToken);
    Task<WorkforceImportSession> FinishNoWorkAsync(Guid sessionId, uint ifMatchVersion, WorkforceImportActor actor, CancellationToken cancellationToken);
    Task<bool> DiscardAsync(Guid sessionId, uint ifMatchVersion, WorkforceImportActor actor, CancellationToken cancellationToken);
    Task<int> PurgeExpiredAsync(DateTime nowUtc, CancellationToken cancellationToken);
}

/// <summary>
/// Owns the temporary, tenant-scoped Workforce Import session lifecycle: idempotent intake,
/// single-active-per-tenant enforcement, resumable read, immediate decision autosave under
/// optimistic (xmin) concurrency, baseline change, Replace source, discard-with-purge, and the
/// real expiry cleanup path. This is one canonical subsystem — it does not revive the retired
/// Employee Import product contract.
/// </summary>
public sealed class WorkforceImportSessionService(
    CoreHRDbContext context,
    ITenantContext tenant,
    ISafeTabularSourceReader reader,
    WorkforceImportSourceAdapter adapter) : IWorkforceImportSessionService
{
    private Guid TenantId => tenant.TenantId;

    public async Task<WorkforceImportIntakeOutcome> IntakeAsync(
        WorkforceImportIntakeRequest request,
        CancellationToken cancellationToken)
    {
        var nowUtc = DateTime.UtcNow;
        var inspection = await reader.InspectAsync(request.File, request.FileName, request.ContentType, request.SelectedSheetName, cancellationToken);
        var shape = adapter.Adapt(inspection);
        if (shape.SheetSelectionRequired)
        {
            return new WorkforceImportIntakeOutcome(
                WorkforceImportIntakeKind.SheetSelectionRequired,
                Replayed: false,
                Session: null,
                SheetChoice: new WorkforceImportSheetChoice(inspection.FileName, inspection.Format, inspection.ByteLength, inspection.Sha256, shape.Sheets),
                ConflictReason: null);
        }

        var sheet = inspection.SelectedSheet!;
        var fingerprint = ComputeFingerprint(inspection.Sha256, request.BaselineDate, sheet.Name);

        var existingForToken = await context.WorkforceImportSessions
            .Include(session => session.Source)
            .Include(session => session.Rows)
            .SingleOrDefaultAsync(session => session.TenantId == TenantId && session.CreationToken == request.CreationToken, cancellationToken);
        if (existingForToken is not null)
        {
            // Same token + same source/options replays the existing session; same token + a
            // different source/options is a conflict.
            if (existingForToken.CreationFingerprint == fingerprint && existingForToken.IsActive)
                return new WorkforceImportIntakeOutcome(WorkforceImportIntakeKind.Ready, Replayed: true, existingForToken, null, null);
            return new WorkforceImportIntakeOutcome(WorkforceImportIntakeKind.Conflict, false, existingForToken.IsActive ? existingForToken : null, null, "This import token was already used for a different source.");
        }

        // At most one active session per tenant for MVP: surface the existing one to resume.
        var active = await GetActiveAsync(cancellationToken);
        if (active is not null)
            return new WorkforceImportIntakeOutcome(WorkforceImportIntakeKind.ActiveSessionExists, false, active, null, "An unfinished import already exists for this tenant.");

        // Provisional columns from the reader's row-0; a header choice will finalize them.
        var provisionalColumns = WorkforceImportJson.Serialize(sheet.Table.Columns.Select(c => c.Label?.Trim()).ToList());
        var session = WorkforceImportSession.Create(
            TenantId, request.BaselineDate, request.CreationToken, fingerprint, sheet.Name, request.Actor, nowUtc, request.Retention);
        var source = WorkforceImportSource.Create(
            TenantId, session.Id, inspection.FileName, inspection.Format, inspection.ContentType, inspection.Sha256,
            sheet.Name, sheet.Range, sheet.ColumnCount, sheet.RowCount,
            shape.Selected?.ColumnsJson ?? provisionalColumns, inspection.RawBytes);
        session.AttachSource(source);

        if (shape.HeaderClarificationRequired)
        {
            // Persist the session/source now (no re-upload later); the header choice is an ETag'd decision.
            context.WorkforceImportSessions.Add(session);
            await context.SaveChangesAsync(cancellationToken);
            return new WorkforceImportIntakeOutcome(
                WorkforceImportIntakeKind.HeaderClarificationRequired, false, session, null, null, shape.HeaderCandidates);
        }

        session.ReplaceRows(shape.Selected!.Rows.Select(row => WorkforceImportRow.Create(TenantId, session.Id, row.SourceRowNumber, row.CellsJson)));
        context.WorkforceImportSessions.Add(session);
        await context.SaveChangesAsync(cancellationToken);
        return new WorkforceImportIntakeOutcome(WorkforceImportIntakeKind.Ready, Replayed: false, session, null, null);
    }

    public async Task<WorkforceImportSession> SelectHeaderRowAsync(
        Guid sessionId, int headerRowIndex, uint ifMatchVersion, WorkforceImportActor actor, CancellationToken cancellationToken)
    {
        var session = await context.WorkforceImportSessions
            .Include(s => s.Source)
            .SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken)
            ?? throw new WorkforceImportNotFoundException(sessionId);
        if (session.Source.RawBytes is null)
            throw new TabularSourceException("SourcePurged", "The uploaded source is no longer available.");

        // Reinterpret the SAME persisted source with the chosen header row — no re-upload.
        using var stream = new MemoryStream(session.Source.RawBytes, writable: false);
        var inspection = await reader.InspectAsync(stream, session.Source.OriginalFileName, session.Source.ContentType, session.Source.SelectedSheetName, cancellationToken);
        var shape = adapter.Adapt(inspection, headerRowIndex);
        if (shape.Selected is null)
            throw new TabularSourceException("HeaderSelectionInvalid", "Choose a valid header row.");

        var selected = shape.Selected;
        session.Source.UpdateInterpretation(selected.Name, selected.Range, selected.ColumnCount, selected.RowCount, selected.ColumnsJson);
        await context.WorkforceImportRows.Where(row => row.SessionId == sessionId).ExecuteDeleteAsync(cancellationToken);
        context.WorkforceImportRows.AddRange(
            selected.Rows.Select(row => WorkforceImportRow.Create(TenantId, session.Id, row.SourceRowNumber, row.CellsJson)));
        session.MoveToInterpreting(actor);
        await SaveWithConcurrencyAsync(session, ifMatchVersion, cancellationToken);
        return session;
    }

    public Task<WorkforceImportSession?> GetAsync(Guid sessionId, CancellationToken cancellationToken)
        => context.WorkforceImportSessions
            .Include(session => session.Source)
            .SingleOrDefaultAsync(session => session.Id == sessionId, cancellationToken);

    public Task<WorkforceImportSession?> GetActiveAsync(CancellationToken cancellationToken)
        => context.WorkforceImportSessions
            .Include(session => session.Source)
            .Where(session => session.Status == WorkforceImportStatus.Intake
                || session.Status == WorkforceImportStatus.Interpreting
                || session.Status == WorkforceImportStatus.Reviewing
                || session.Status == WorkforceImportStatus.Ready
                || session.Status == WorkforceImportStatus.Applying)
            .OrderByDescending(session => session.UpdatedAt ?? session.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<WorkforceImportSession> ReplaceDecisionsAsync(
        Guid sessionId, string decisionsJson, uint ifMatchVersion, WorkforceImportActor actor, CancellationToken cancellationToken)
    {
        var session = await RequireAsync(sessionId, cancellationToken);
        session.ReplaceDecisions(decisionsJson, actor);
        await SaveWithConcurrencyAsync(session, ifMatchVersion, cancellationToken);
        return session;
    }

    public async Task<WorkforceImportSession> ChangeBaselineDateAsync(
        Guid sessionId, DateOnly baselineDate, uint ifMatchVersion, WorkforceImportActor actor, CancellationToken cancellationToken)
    {
        var session = await RequireAsync(sessionId, cancellationToken);
        session.ChangeBaselineDate(baselineDate, actor, DateTime.UtcNow);
        // A baseline change re-opens interpretation/review; the review digest no longer holds.
        session.MoveToInterpreting(actor);
        await SaveWithConcurrencyAsync(session, ifMatchVersion, cancellationToken);
        return session;
    }

    public async Task<WorkforceImportSession> ReplaceSourceAsync(
        Guid sessionId, WorkforceImportReplaceSourceRequest request, uint ifMatchVersion, CancellationToken cancellationToken)
    {
        var session = await context.WorkforceImportSessions
            .Include(s => s.Source)
            .SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken)
            ?? throw new WorkforceImportNotFoundException(sessionId);

        var inspection = await reader.InspectAsync(request.File, request.FileName, request.ContentType, request.SelectedSheetName, cancellationToken);
        var shape = adapter.Adapt(inspection);
        if (shape.SheetSelectionRequired || shape.HeaderClarificationRequired || shape.Selected is null)
            throw new TabularSourceException("SheetSelectionRequired", "Choose which sheet and header row the workforce uses.");

        var selected = shape.Selected;
        // Replace source preserves the baseline and re-runs inspection on the same source record.
        // Row-derived state is rebuilt from the new source; the review digest is invalidated.
        // (Selective survival of still-valid column mappings vs. row-derived decisions is applied by interpretation.)
        session.Source.ReplaceContent(
            inspection.FileName, inspection.Format, inspection.ContentType, inspection.Sha256,
            selected.Name, selected.Range, selected.ColumnCount, selected.RowCount, selected.ColumnsJson, inspection.RawBytes);
        await context.WorkforceImportRows.Where(row => row.SessionId == sessionId).ExecuteDeleteAsync(cancellationToken);
        context.WorkforceImportRows.AddRange(
            selected.Rows.Select(row => WorkforceImportRow.Create(TenantId, session.Id, row.SourceRowNumber, row.CellsJson)));
        session.MoveToInterpreting(request.Actor);
        await SaveWithConcurrencyAsync(session, ifMatchVersion, cancellationToken);
        return session;
    }

    public async Task<WorkforceImportSession> FinishNoWorkAsync(Guid sessionId, uint ifMatchVersion, WorkforceImportActor actor, CancellationToken cancellationToken)
    {
        var session = await context.WorkforceImportSessions.Include(s => s.Source)
            .SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken)
            ?? throw new WorkforceImportNotFoundException(sessionId);
        session.CompleteNoWork(actor);
        // Meaningful terminal outcome: a zero-added history record so the completed no-work journey is queryable.
        context.WorkforceImportHistories.Add(WorkforceImportHistory.Create(
            TenantId, session.Id, session.BaselineDate, session.Source.OriginalFileName, session.Source.Sha256,
            actor, DateTime.UtcNow, 0, session.ExistingAnchorCount, session.ExcludedCount, "[]", null));
        await SaveWithConcurrencyAsync(session, ifMatchVersion, cancellationToken);
        return session;
    }

    public async Task<bool> DiscardAsync(Guid sessionId, uint ifMatchVersion, WorkforceImportActor actor, CancellationToken cancellationToken)
    {
        var session = await context.WorkforceImportSessions
            .Include(s => s.Source)
            .Include(s => s.Rows)
            .SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken)
            ?? throw new WorkforceImportNotFoundException(sessionId);
        var discarded = session.Discard(actor);
        await SaveWithConcurrencyAsync(session, ifMatchVersion, cancellationToken);
        return discarded;
    }

    /// <summary>
    /// The real expiry cleanup path (not a status flip): finds non-terminal sessions past their
    /// retention window and expires them, which purges temporary source/row PII in place.
    /// </summary>
    public async Task<int> PurgeExpiredAsync(DateTime nowUtc, CancellationToken cancellationToken)
    {
        var expiring = await context.WorkforceImportSessions
            .Include(s => s.Source)
            .Include(s => s.Rows)
            .Where(s => s.ExpiresAt <= nowUtc
                && s.Status != WorkforceImportStatus.Committed
                && s.Status != WorkforceImportStatus.Discarded
                && s.Status != WorkforceImportStatus.Expired
                && s.Status != WorkforceImportStatus.Applying)
            .ToListAsync(cancellationToken);
        var count = 0;
        foreach (var session in expiring)
            if (session.Expire(nowUtc)) count++;
        if (count > 0) await context.SaveChangesAsync(cancellationToken);
        return count;
    }

    private async Task<WorkforceImportSession> RequireAsync(Guid sessionId, CancellationToken cancellationToken)
        => await context.WorkforceImportSessions
            .Include(session => session.Source)
            .SingleOrDefaultAsync(session => session.Id == sessionId, cancellationToken)
            ?? throw new WorkforceImportNotFoundException(sessionId);

    private async Task SaveWithConcurrencyAsync(WorkforceImportSession session, uint ifMatchVersion, CancellationToken cancellationToken)
    {
        // Explicit If-Match against the freshly-loaded ETag, then let EF's natural xmin concurrency
        // guard the write (this stays correct when related source/row entities are also modified).
        if (session.Version != ifMatchVersion)
            throw new WorkforceImportConcurrencyException(session.Id);
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new WorkforceImportConcurrencyException(session.Id);
        }
    }

    private static string ComputeFingerprint(string sha256, DateOnly baseline, string selectedSheet)
    {
        var composite = $"{sha256}|{baseline:yyyy-MM-dd}|{selectedSheet}";
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(composite)))[..64];
    }
}
