using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Services;

/// <summary>
/// Performs the closure transition itself: closes the campaign, cascades to its open evaluation
/// rounds, and records the audit trail. Shared by all three routes into closure — the inline path in
/// the finalize transaction, the reconciliation sweep, and HR's manual close — so the three cannot
/// diverge in what closing actually means.
/// </summary>
public sealed class CampaignCloser(PerformanceDbContext dbContext, ITenantContext tenantContext)
{
    /// <summary>
    /// Stages the closure on the tracked graph without saving. The caller owns the unit of work, so
    /// closure commits with whatever transition triggered it or not at all.
    /// </summary>
    /// <returns>False when the campaign is already closed or was never launched.</returns>
    public async Task<bool> StageCloseAsync(
        Guid campaignId,
        CampaignClosureKind closureKind,
        Guid? actorUserId,
        string? actorName,
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        var campaign = await dbContext.PerformanceCycles
            .FirstOrDefaultAsync(candidate => candidate.Id == campaignId, cancellationToken);

        if (campaign is null || campaign.IsClosed || campaign.Status == PerformanceCycleStatus.Draft)
        {
            return false;
        }

        // Rounds are their own aggregate, so the cascade lives here rather than inside the cycle.
        var openRounds = await dbContext.EvaluationRounds
            .Where(round => round.PerformanceCycleId == campaignId
                            && round.Status != EvaluationRoundStatus.Closed)
            .ToListAsync(cancellationToken);

        foreach (var round in openRounds)
        {
            round.Close(occurredAt);

            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                tenantContext.TenantId,
                campaignId,
                PerformanceCycleAuditAction.EvaluationRoundClosed,
                actorUserId,
                actorName,
                details: $"Round '{round.Name}' closed with the campaign."));
        }

        campaign.Close(closureKind, actorUserId, actorName, occurredAt);

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantContext.TenantId,
            campaignId,
            PerformanceCycleAuditAction.CampaignClosed,
            actorUserId,
            actorName,
            details: closureKind == CampaignClosureKind.Automatic
                ? "Closed automatically: every manager assessment was finalized."
                : "Closed by HR."));

        return true;
    }
}
