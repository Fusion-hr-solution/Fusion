using System.Text.Json;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

/// <summary>Product-facing publication status; no queue, worker or EF terminology.</summary>
public sealed record WorkforceImportApplyStatusDto(
    string Status, string Phase, int Processed, int? Total,
    WorkforceImportApplyResult? Result, WorkforceReviewOutdatedResult? ReviewOutdated, string? Message);

/// <summary>
/// The Publish boundary. It accepts only the exact proposal the administrator reviewed: the attempt
/// must be publishable now and the confirmed proposal fingerprint must equal the current one.
/// It then freezes the attempt and queues one publication operation; the background worker
/// re-derives inside the write transaction and publishes only if the fingerprint still matches.
/// </summary>
public sealed class WorkforceImportApplyOperationService(CoreHRDbContext context, ITenantContext tenant)
{
    private Guid TenantId => tenant.TenantId;

    public async Task<WorkforceImportApplyStatusDto> PublishAsync(
        Guid sessionId, uint ifMatchVersion, string? reviewedProposalFingerprint, ImportActor actor, CancellationToken cancellationToken)
    {
        var session = await context.WorkforceImportSessions
            .SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken)
            ?? throw new WorkforceImportNotFoundException(sessionId);

        var existing = await context.WorkforceImportApplyOperations.SingleOrDefaultAsync(o => o.SessionId == sessionId, cancellationToken);

        // Idempotent replay: a committed attempt returns its stored result; an in-flight publication returns its status.
        if (session.Status == WorkforceImportStatus.Committed)
            return existing is not null ? ToDto(existing) : Committed(session);
        if (existing is not null && !existing.IsTerminal)
            return ToDto(existing);
        if (session.Status == WorkforceImportStatus.Discarded)
            throw new WorkforceImportReviewException("This import was discarded.", "ImportTerminal");

        if (session.Version != ifMatchVersion) throw new WorkforceImportConcurrencyException(sessionId);
        if (!session.CanPublish)
            throw new WorkforceImportReviewException(
                session.CreateCount == 0 && session.BlockedCount == 0 ? "There's nobody new to import." : "Resolve every blocking issue before publishing.",
                "NotPublishable");
        if (!ImportFingerprint.Matches(session.ProposalFingerprint, reviewedProposalFingerprint))
            throw new WorkforceImportReviewException(
                "The workforce changed since you reviewed it. Review the current result before publishing.", "ProposalChanged");

        session.BeginPublish(actor);
        if (existing is null)
        {
            existing = WorkforceImportApplyOperation.Queue(TenantId, sessionId, session.ProposalFingerprint!, actor);
            context.WorkforceImportApplyOperations.Add(existing);
        }
        else
        {
            existing.Requeue(session.ProposalFingerprint!, actor);
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
        return session?.Status == WorkforceImportStatus.Committed ? Committed(session) : null;
    }

    internal static WorkforceImportApplyStatusDto ToDto(WorkforceImportApplyOperation op)
    {
        var result = op.ResultJson is null ? null : JsonSerializer.Deserialize<WorkforceImportApplyResult>(op.ResultJson);
        var outdated = op.ReviewOutdatedJson is null ? null : JsonSerializer.Deserialize<WorkforceReviewOutdatedResult>(op.ReviewOutdatedJson);
        var message = op.Status switch
        {
            WorkforceImportApplyStatus.Failed => "The workforce wasn't published. Nobody was added.",
            WorkforceImportApplyStatus.ReviewOutdated => "The workforce changed since you reviewed it.",
            _ => null,
        };
        return new WorkforceImportApplyStatusDto(op.Status.ToString(), op.Phase, op.ProcessedCount, op.TotalCount, result, outdated, message);
    }

    private static WorkforceImportApplyStatusDto Committed(WorkforceImportSession session)
    {
        var result = session.CommitResultJson is null ? null : JsonSerializer.Deserialize<WorkforceImportApplyResult>(session.CommitResultJson);
        return new WorkforceImportApplyStatusDto("Succeeded", "Saved", result?.AddedEmployeeCount ?? 0, result?.AddedEmployeeCount ?? 0, result, null, null);
    }
}
