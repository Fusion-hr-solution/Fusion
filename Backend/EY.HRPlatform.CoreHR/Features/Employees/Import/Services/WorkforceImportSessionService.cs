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
    Task<WorkforceImportSession> SelectHeaderRowAsync(Guid sessionId, int headerRowIndex, uint ifMatchVersion, ImportActor actor, CancellationToken cancellationToken);
    Task<bool> DiscardAsync(Guid sessionId, uint ifMatchVersion, ImportActor actor, CancellationToken cancellationToken);
}

/// <summary>
/// The Workforce Import attempt lifecycle, shared in shape with Organization Import: idempotent
/// intake (creation token + source fingerprint), resumable server state, optimistic (xmin)
/// concurrency, explicit discard with payload purge. Intake derives the proposal immediately and
/// runs semantic assistance inside the upload budget, so the attempt opens on its real stage.
/// An attempt is bound to one source; a corrected file is a new attempt.
/// </summary>
public sealed class WorkforceImportSessionService(
    CoreHRDbContext context,
    ITenantContext tenant,
    ISafeTabularSourceReader reader,
    WorkforceImportSourceAdapter adapter,
    WorkforceImportDerivation derivation,
    WorkforceImportSemanticAssistanceService semantic) : IWorkforceImportSessionService
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
        var fingerprint = ImportFingerprint.Hash($"{inspection.Sha256}|{request.BaselineDate:yyyy-MM-dd}|{sheet.Name}");

        var existingForToken = await context.WorkforceImportSessions
            .Include(session => session.Source)
            .SingleOrDefaultAsync(session => session.TenantId == TenantId && session.CreationToken == request.CreationToken, cancellationToken);
        if (existingForToken is not null)
        {
            // Same token + same source/options replays the attempt; a different source is a conflict.
            if (ImportFingerprint.Matches(existingForToken.CreationFingerprint, fingerprint) && existingForToken.IsActive)
                return new WorkforceImportIntakeOutcome(WorkforceImportIntakeKind.Ready, Replayed: true, existingForToken, null, null);
            return new WorkforceImportIntakeOutcome(WorkforceImportIntakeKind.Conflict, false, null, null,
                "This upload was already used for a different file.");
        }

        var provisionalColumns = WorkforceImportJson.Serialize(sheet.Table.Columns.Select(c => c.Label?.Trim()).ToList());
        var session = WorkforceImportSession.Create(
            TenantId, request.BaselineDate, request.CreationToken, fingerprint, sheet.Name, request.Actor, nowUtc);
        var source = WorkforceImportSource.Create(
            TenantId, session.Id, inspection.FileName, inspection.Format, inspection.ContentType, inspection.Sha256,
            sheet.Name, sheet.Range, sheet.ColumnCount, sheet.RowCount,
            shape.Selected?.ColumnsJson ?? provisionalColumns, inspection.RawBytes);
        session.AttachSource(source);

        if (shape.HeaderClarificationRequired)
        {
            // Persist the attempt now (no re-upload later); the header choice is an ETag'd decision.
            context.WorkforceImportSessions.Add(session);
            await context.SaveChangesAsync(cancellationToken);
            return new WorkforceImportIntakeOutcome(
                WorkforceImportIntakeKind.HeaderClarificationRequired, false, session, null, null, shape.HeaderCandidates);
        }

        session.ReplaceRows(shape.Selected!.Rows.Select(row => WorkforceImportRow.Create(TenantId, session.Id, row.SourceRowNumber, row.CellsJson)));
        context.WorkforceImportSessions.Add(session);
        await context.SaveChangesAsync(cancellationToken);
        await DeriveAndAssistAsync(session, request.Actor, cancellationToken);
        return new WorkforceImportIntakeOutcome(WorkforceImportIntakeKind.Ready, Replayed: false, await ReloadAsync(session.Id, cancellationToken), null, null);
    }

    public async Task<WorkforceImportSession> SelectHeaderRowAsync(
        Guid sessionId, int headerRowIndex, uint ifMatchVersion, ImportActor actor, CancellationToken cancellationToken)
    {
        var session = await RequireMutableAsync(sessionId, cancellationToken);
        if (session.Source.RawBytes is null)
            throw new TabularSourceException("SourcePurged", "The uploaded source is no longer available.");

        // Reinterpret the SAME persisted source with the chosen header row; no re-upload.
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
        session.ReplaceMappingPlan("{}", actor);
        await SaveWithConcurrencyAsync(session, ifMatchVersion, cancellationToken);
        await DeriveAndAssistAsync(session, actor, cancellationToken);
        return await ReloadAsync(sessionId, cancellationToken);
    }

    public Task<WorkforceImportSession?> GetAsync(Guid sessionId, CancellationToken cancellationToken)
        => context.WorkforceImportSessions
            .Include(session => session.Source)
            .SingleOrDefaultAsync(session => session.Id == sessionId, cancellationToken);

    /// <summary>The most recent attempt still in progress, to resume from Upload.</summary>
    public Task<WorkforceImportSession?> GetActiveAsync(CancellationToken cancellationToken)
        => context.WorkforceImportSessions
            .Include(session => session.Source)
            .Where(session => session.Status == WorkforceImportStatus.Active)
            .OrderByDescending(session => session.UpdatedAt ?? session.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<bool> DiscardAsync(Guid sessionId, uint ifMatchVersion, ImportActor actor, CancellationToken cancellationToken)
    {
        var session = await context.WorkforceImportSessions
            .Include(s => s.Source)
            .Include(s => s.Rows)
            .SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken)
            ?? throw new WorkforceImportNotFoundException(sessionId);
        if (session.IsPublishing)
            throw new WorkforceImportReviewException("This import is being published.", "ImportPublishing");
        var discarded = session.Discard(actor);
        await SaveWithConcurrencyAsync(session, ifMatchVersion, cancellationToken);
        return discarded;
    }

    /// <summary>Derives the proposal, then lets semantic assistance fill what deterministic interpretation left open.</summary>
    private async Task DeriveAndAssistAsync(WorkforceImportSession session, ImportActor actor, CancellationToken cancellationToken)
    {
        await derivation.RecomputeAsync(session, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);
        await semantic.RunAfterUploadAsync(session.Id, actor, cancellationToken);
    }

    private async Task<WorkforceImportSession> ReloadAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        context.ChangeTracker.Clear();
        return await GetAsync(sessionId, cancellationToken) ?? throw new WorkforceImportNotFoundException(sessionId);
    }

    private async Task<WorkforceImportSession> RequireMutableAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await context.WorkforceImportSessions
            .Include(s => s.Source)
            .SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken)
            ?? throw new WorkforceImportNotFoundException(sessionId);
        if (!session.IsActive) throw new WorkforceImportReviewException("This import is finished.", "ImportTerminal");
        if (session.IsPublishing) throw new WorkforceImportReviewException("This import is being published.", "ImportPublishing");
        return session;
    }

    private async Task SaveWithConcurrencyAsync(WorkforceImportSession session, uint ifMatchVersion, CancellationToken cancellationToken)
    {
        // Explicit If-Match against the freshly-loaded ETag, then EF's xmin guard for the write itself.
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
}
