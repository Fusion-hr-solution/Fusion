using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Progress;

/// <summary>
/// Resolves the effective reviewer for campaign participants: the frozen approver from the P1.2
/// baseline, overridden by the latest P1.6 reviewer reassignment. This is the single source of the
/// "who reviews whom" rule shared by team-progress reads and progress-evidence authorization, so the
/// rule never drifts between them. Live Core reporting lines are never consulted.
/// </summary>
public sealed class EffectiveReviewerResolver(PerformanceDbContext dbContext)
{
    public async Task<Dictionary<Guid, Guid>> ResolveForCampaignAsync(
        Guid cycleId,
        CancellationToken cancellationToken)
    {
        var participants = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(participant => participant.CycleId == cycleId)
            .Select(participant => new { participant.EmployeeId, participant.ApproverEmployeeId })
            .ToListAsync(cancellationToken);

        var reassignmentByParticipant = await LatestReassignmentsAsync(cycleId, cancellationToken);

        return participants.ToDictionary(
            participant => participant.EmployeeId,
            participant => reassignmentByParticipant.TryGetValue(participant.EmployeeId, out var reassignment)
                ? reassignment.NewApproverEmployeeId
                : participant.ApproverEmployeeId);
    }

    public async Task<Guid?> ResolveForParticipantAsync(
        Guid cycleId,
        Guid participantEmployeeId,
        CancellationToken cancellationToken)
    {
        var reassignment = await dbContext.PerformanceCycleApproverReassignments
            .AsNoTracking()
            .Where(item => item.CycleId == cycleId && item.ParticipantEmployeeId == participantEmployeeId)
            .OrderByDescending(item => item.ReassignedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (reassignment is not null)
            return reassignment.NewApproverEmployeeId;

        var participant = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.CycleId == cycleId && item.EmployeeId == participantEmployeeId,
                cancellationToken);
        return participant?.ApproverEmployeeId;
    }

    private async Task<Dictionary<Guid, PerformanceCycleApproverReassignment>> LatestReassignmentsAsync(
        Guid cycleId,
        CancellationToken cancellationToken)
    {
        var reassignments = await dbContext.PerformanceCycleApproverReassignments
            .AsNoTracking()
            .Where(item => item.CycleId == cycleId)
            .OrderBy(item => item.ReassignedAt)
            .ToListAsync(cancellationToken);

        return reassignments
            .GroupBy(item => item.ParticipantEmployeeId)
            .ToDictionary(group => group.Key, group => group.Last());
    }
}
