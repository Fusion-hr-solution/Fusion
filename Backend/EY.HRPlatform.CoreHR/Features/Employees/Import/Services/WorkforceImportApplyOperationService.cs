using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

/// <summary>Product-facing Apply operation status — no queue/worker/EF terminology.</summary>
public sealed record WorkforceImportApplyStatusDto(
    string Status, string Phase, int Processed, int? Total,
    WorkforceImportApplyResult? Result, WorkforceReviewOutdatedResult? ReviewOutdated, string? Message);

/// <summary>
/// The user-visible boundary for Complete import: freezes the reviewed session, creates or replays
/// one Apply operation, and returns an observable status the frontend can poll after reconnect.
/// Execution happens in the background worker; this service never blocks on it.
/// </summary>
public sealed class WorkforceImportApplyOperationService(CoreHRDbContext context, ITenantContext tenant)
{
    private Guid TenantId => tenant.TenantId;

    public async Task<WorkforceImportApplyStatusDto> CompleteImportAsync(
        Guid sessionId, uint ifMatchVersion, WorkforceImportActor actor, CancellationToken cancellationToken)
    {
        var session = await context.WorkforceImportSessions
            .SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken)
            ?? throw new WorkforceImportNotFoundException(sessionId);

        var existing = await context.WorkforceImportApplyOperations.SingleOrDefaultAsync(o => o.SessionId == sessionId, cancellationToken);

        // Idempotent replay: a committed session (or an existing operation) returns current state.
        if (session.Status == WorkforceImportStatus.Committed)
            return existing is not null ? ToDto(existing) : new WorkforceImportApplyStatusDto("Succeeded", "Saved", session.NewCount, session.NewCount, ReplayFrom(session), null, null);
        if (existing is not null && !existing.IsTerminal)
            return ToDto(existing); // same in-flight operation
        if (session.Status is WorkforceImportStatus.Discarded or WorkforceImportStatus.Expired)
            throw new WorkforceImportReviewException("This import is no longer active.");

        if (session.Version != ifMatchVersion) throw new WorkforceImportConcurrencyException(sessionId);

        // Freeze the session and (re)create the operation atomically.
        session.BeginApply(session.ReviewDigest ?? string.Empty, actor);
        if (existing is null)
        {
            existing = WorkforceImportApplyOperation.Queue(TenantId, sessionId, actor);
            context.WorkforceImportApplyOperations.Add(existing);
        }
        else
        {
            existing.Requeue();
        }
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new WorkforceImportConcurrencyException(sessionId); }
        return ToDto(existing);
    }

    public async Task<WorkforceImportApplyStatusDto?> GetStatusAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var op = await context.WorkforceImportApplyOperations.AsNoTracking().SingleOrDefaultAsync(o => o.SessionId == sessionId, cancellationToken);
        if (op is not null) return ToDto(op);
        var session = await context.WorkforceImportSessions.AsNoTracking().SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken);
        return session?.Status == WorkforceImportStatus.Committed
            ? new WorkforceImportApplyStatusDto("Succeeded", "Saved", session.NewCount, session.NewCount, ReplayFrom(session), null, null)
            : null;
    }

    private static WorkforceImportApplyStatusDto ToDto(WorkforceImportApplyOperation op)
    {
        var result = op.ResultJson is null ? null : System.Text.Json.JsonSerializer.Deserialize<WorkforceImportApplyResult>(op.ResultJson);
        var outdated = op.ReviewOutdatedJson is null ? null : System.Text.Json.JsonSerializer.Deserialize<WorkforceReviewOutdatedResult>(op.ReviewOutdatedJson);
        var message = op.Status == WorkforceImportApplyStatus.Failed
            ? "The import wasn't completed. No employees were added."
            : op.Status == WorkforceImportApplyStatus.ReviewOutdated ? "A few items changed since your review." : null;
        return new WorkforceImportApplyStatusDto(op.Status.ToString(), op.Phase, op.ProcessedCount, op.TotalCount, result, outdated, message);
    }

    private static WorkforceImportApplyResult? ReplayFrom(WorkforceImportSession session)
        => session.CommitResultJson is null ? null : System.Text.Json.JsonSerializer.Deserialize<WorkforceImportApplyResult>(session.CommitResultJson);
}
