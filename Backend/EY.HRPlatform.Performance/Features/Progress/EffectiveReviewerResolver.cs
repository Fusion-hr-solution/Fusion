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
    /// <summary>
    /// The whole-campaign map. Use only where every participant is genuinely needed — an HR-level
    /// readiness or completion view. A per-reviewer read must use
    /// <see cref="ResolveParticipantsForReviewerAsync"/> instead.
    /// </summary>
    public async Task<Dictionary<Guid, Guid>> ResolveForCampaignAsync(
        Guid cycleId,
        CancellationToken cancellationToken)
        => (await ResolveCampaignMapAsync(cycleId, cancellationToken)).ReviewerByParticipant;

    /// <summary>
    /// The whole-campaign map plus the reassignments it was derived from, so a caller that needs
    /// both (readiness shows the reassigned reviewer's name) reads the reassignment table once.
    /// </summary>
    public async Task<CampaignEffectiveReviewers> ResolveCampaignMapAsync(
        Guid cycleId,
        CancellationToken cancellationToken)
    {
        var participants = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(participant => participant.CycleId == cycleId)
            .Select(participant => new { participant.EmployeeId, participant.ApproverEmployeeId })
            .ToListAsync(cancellationToken);

        var reassignmentByParticipant = await LatestReassignmentsAsync(cycleId, null, cancellationToken);

        var reviewerByParticipant = participants.ToDictionary(
            participant => participant.EmployeeId,
            participant => reassignmentByParticipant.TryGetValue(participant.EmployeeId, out var reassignment)
                ? reassignment.NewApproverEmployeeId
                : participant.ApproverEmployeeId);

        return new CampaignEffectiveReviewers(reviewerByParticipant, reassignmentByParticipant);
    }

    /// <summary>
    /// Resolves the effective reviewer for a known, bounded set of participants — the right shape
    /// for a job that already knows which few participants it is acting on.
    /// </summary>
    public async Task<Dictionary<Guid, Guid>> ResolveForParticipantsAsync(
        Guid cycleId,
        IReadOnlyCollection<Guid> participantEmployeeIds,
        CancellationToken cancellationToken)
    {
        if (participantEmployeeIds.Count == 0)
        {
            return [];
        }

        var participants = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(participant => participant.CycleId == cycleId
                                  && participantEmployeeIds.Contains(participant.EmployeeId))
            .Select(participant => new { participant.EmployeeId, participant.ApproverEmployeeId })
            .ToListAsync(cancellationToken);

        var reassignmentByParticipant = await LatestReassignmentsAsync(
            cycleId, participantEmployeeIds, cancellationToken);

        return participants.ToDictionary(
            participant => participant.EmployeeId,
            participant => reassignmentByParticipant.TryGetValue(participant.EmployeeId, out var reassignment)
                ? reassignment.NewApproverEmployeeId
                : participant.ApproverEmployeeId);
    }

    /// <summary>
    /// Returns the participants whose effective reviewer is <paramref name="reviewerEmployeeId"/>,
    /// resolving the rule in SQL so the read costs the reviewer's scope rather than the tenant's.
    /// </summary>
    /// <remarks>
    /// Same rule as <see cref="ResolveForCampaignAsync"/> — frozen approver, overridden by the
    /// latest reassignment — expressed once, as a predicate the database can apply. A manager who
    /// reviews 8 of 1,200 participants reads 8 rows, not 1,200. An empty scope returns empty; it
    /// never widens to the full population.
    /// </remarks>
    public async Task<IReadOnlyList<Guid>> ResolveParticipantsForReviewerAsync(
        Guid cycleId,
        Guid reviewerEmployeeId,
        CancellationToken cancellationToken)
        => await ParticipantsForReviewerQuery(cycleId, reviewerEmployeeId)
            .Select(participant => participant.EmployeeId)
            .ToListAsync(cancellationToken);

    /// <summary>
    /// The reviewer-scoped map, for callers that need each participant's effective reviewer rather
    /// than just the membership set.
    /// </summary>
    public async Task<Dictionary<Guid, Guid>> ResolveForReviewerAsync(
        Guid cycleId,
        Guid reviewerEmployeeId,
        CancellationToken cancellationToken)
    {
        var employeeIds = await ResolveParticipantsForReviewerAsync(cycleId, reviewerEmployeeId, cancellationToken);
        return employeeIds.ToDictionary(employeeId => employeeId, _ => reviewerEmployeeId);
    }

    /// <summary>
    /// The effective-reviewer rule as a translatable predicate: COALESCE(latest reassignment,
    /// frozen approver) = the reviewer in question.
    /// </summary>
    private IQueryable<PerformanceCycleParticipant> ParticipantsForReviewerQuery(
        Guid cycleId,
        Guid reviewerEmployeeId)
        => dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(participant => participant.CycleId == cycleId)
            .Where(participant =>
                (dbContext.PerformanceCycleApproverReassignments
                    .Where(item => item.CycleId == cycleId
                                   && item.ParticipantEmployeeId == participant.EmployeeId)
                    .OrderByDescending(item => item.ReassignedAt)
                    .Select(item => (Guid?)item.NewApproverEmployeeId)
                    .FirstOrDefault() ?? participant.ApproverEmployeeId) == reviewerEmployeeId);

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
        IReadOnlyCollection<Guid>? participantEmployeeIds,
        CancellationToken cancellationToken)
    {
        var query = dbContext.PerformanceCycleApproverReassignments
            .AsNoTracking()
            .Where(item => item.CycleId == cycleId);

        if (participantEmployeeIds is not null)
        {
            query = query.Where(item => participantEmployeeIds.Contains(item.ParticipantEmployeeId));
        }

        var reassignments = await query
            .OrderBy(item => item.ReassignedAt)
            .ToListAsync(cancellationToken);

        return reassignments
            .GroupBy(item => item.ParticipantEmployeeId)
            .ToDictionary(group => group.Key, group => group.Last());
    }
}

/// <summary>
/// A campaign's effective reviewers together with the reassignments that produced them.
/// </summary>
public sealed record CampaignEffectiveReviewers(
    Dictionary<Guid, Guid> ReviewerByParticipant,
    Dictionary<Guid, PerformanceCycleApproverReassignment> LatestReassignmentByParticipant);
