using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Services;

/// <summary>
/// Decides whether a campaign has finished its evaluation work and may close automatically.
/// </summary>
/// <remarks>
/// <para>
/// The condition is a single reusable unit on purpose (design D1 risk note): calibration would sit
/// between manager finalization and campaign close, so a future calibration gate must be one added
/// clause here rather than a redesign of every caller.
/// </para>
/// <para>
/// Acknowledgement deliberately does not gate closure. It is employee-initiated and unbounded in
/// time, so gating on it would let one unresponsive employee hold a cycle open forever.
/// </para>
/// </remarks>
public sealed class CampaignClosureEligibilityResolver(PerformanceDbContext dbContext)
{
    /// <summary>
    /// True when every non-excluded manager assessment across all launched rounds is
    /// <see cref="EvaluationAssignmentStatus.Finalized"/>.
    /// </summary>
    /// <remarks>
    /// A campaign with no launched round is never eligible: there is no evaluation work to have
    /// completed, so "all of it is done" would be vacuously true and would close campaigns that
    /// have not started. Those close manually instead.
    /// </remarks>
    public async Task<bool> IsEligibleForAutomaticClosureAsync(
        Guid campaignId,
        CancellationToken cancellationToken)
    {
        var campaignStatus = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Where(campaign => campaign.Id == campaignId)
            .Select(campaign => (PerformanceCycleStatus?)campaign.Status)
            .FirstOrDefaultAsync(cancellationToken);

        if (campaignStatus != PerformanceCycleStatus.Launched)
        {
            return false;
        }

        var launchedRoundIds = await dbContext.EvaluationRounds
            .AsNoTracking()
            .Where(round => round.PerformanceCycleId == campaignId
                            && round.Status == EvaluationRoundStatus.Launched)
            .Select(round => round.Id)
            .ToListAsync(cancellationToken);

        if (launchedRoundIds.Count == 0)
        {
            return false;
        }

        // Excluded participants carry no outstanding work: their recorded work is preserved, but
        // they must not hold the campaign open.
        var outstanding = await dbContext.EvaluationAssignments
            .AsNoTracking()
            .Where(assignment => launchedRoundIds.Contains(assignment.RoundId)
                                 && assignment.Kind == EvaluationAssignmentKind.ManagerAssessment
                                 && assignment.Status != EvaluationAssignmentStatus.Finalized)
            .Where(assignment => !dbContext.EvaluationRoundExclusions
                .Any(exclusion => exclusion.RoundId == assignment.RoundId
                                  && exclusion.ParticipantEmployeeId == assignment.ParticipantEmployeeId))
            .AnyAsync(cancellationToken);

        return !outstanding;
    }

    /// <summary>
    /// Counts what is still outstanding on a campaign, for the impact report HR sees before closing
    /// a campaign manually. Reported as product outcomes, not as enum names.
    /// </summary>
    public async Task<CampaignOutstandingWork> ResolveOutstandingWorkAsync(
        Guid campaignId,
        CancellationToken cancellationToken)
    {
        var launchedRoundIds = await dbContext.EvaluationRounds
            .AsNoTracking()
            .Where(round => round.PerformanceCycleId == campaignId
                            && round.Status == EvaluationRoundStatus.Launched)
            .Select(round => round.Id)
            .ToListAsync(cancellationToken);

        var plans = dbContext.EmployeeObjectivePlans
            .AsNoTracking()
            .Where(plan => plan.CycleId == campaignId);

        var unsubmittedPlans = await plans
            .CountAsync(plan => plan.Status == PlanStatus.Draft || plan.Status == PlanStatus.ChangesRequested,
                cancellationToken);

        var plansAwaitingApproval = await plans
            .CountAsync(plan => plan.Status == PlanStatus.Submitted, cancellationToken);

        var assignments = dbContext.EvaluationAssignments
            .AsNoTracking()
            .Where(assignment => launchedRoundIds.Contains(assignment.RoundId))
            .Where(assignment => !dbContext.EvaluationRoundExclusions
                .Any(exclusion => exclusion.RoundId == assignment.RoundId
                                  && exclusion.ParticipantEmployeeId == assignment.ParticipantEmployeeId));

        var unsubmittedSelfAssessments = await assignments
            .CountAsync(assignment => assignment.Kind == EvaluationAssignmentKind.SelfAssessment
                                      && assignment.Status != EvaluationAssignmentStatus.Submitted
                                      && assignment.Status != EvaluationAssignmentStatus.Finalized,
                cancellationToken);

        var unfinalizedManagerAssessments = await assignments
            .CountAsync(assignment => assignment.Kind == EvaluationAssignmentKind.ManagerAssessment
                                      && assignment.Status != EvaluationAssignmentStatus.Finalized,
                cancellationToken);

        return new CampaignOutstandingWork(
            unsubmittedPlans,
            plansAwaitingApproval,
            unsubmittedSelfAssessments,
            unfinalizedManagerAssessments);
    }
}

/// <summary>What closing a campaign now would leave unfinished.</summary>
public sealed record CampaignOutstandingWork(
    int UnsubmittedObjectivePlans,
    int ObjectivePlansAwaitingApproval,
    int UnsubmittedSelfAssessments,
    int UnfinalizedManagerAssessments)
{
    public bool HasOutstandingWork =>
        UnsubmittedObjectivePlans > 0
        || ObjectivePlansAwaitingApproval > 0
        || UnsubmittedSelfAssessments > 0
        || UnfinalizedManagerAssessments > 0;
}
