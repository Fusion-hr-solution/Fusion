using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Shared;

/// <summary>
/// A command deliberately permitted against a closed campaign, or one that writes nothing
/// campaign-scoped. Every entry needs a stated reason — the exemption set is a reviewable artifact,
/// not an absence.
/// </summary>
[AttributeUsage(AttributeTargets.Class)]
public sealed class ClosedCampaignExemptAttribute(string reason) : Attribute
{
    public string Reason { get; } = reason;
}

/// <summary>The one error code every rejected write against a closed campaign returns.</summary>
public static class CampaignClosureErrors
{
    public const string CampaignClosedCode = "Performance.Campaign.Closed";

    public static Error CampaignClosed() => new(
        CampaignClosedCode,
        "This campaign is closed. Its records are read-only and can no longer be changed.");

    public static Result<T> Failure<T>() => Result.Failure<T>(CampaignClosed());
}

/// <summary>
/// Resolves whether a campaign is closed, for commands that reach their campaign indirectly.
/// </summary>
public sealed class CampaignWriteGuard(PerformanceDbContext dbContext)
{
    /// <summary>Dispatches a resolved scope to the right closure lookup.</summary>
    public Task<bool> IsClosedForScopeAsync(
        CampaignScopeResolver.CampaignScope scope,
        CancellationToken cancellationToken)
        => scope.Kind switch
        {
            CampaignScopeResolver.ScopeKind.Campaign => IsClosedAsync(scope.Id, cancellationToken),
            CampaignScopeResolver.ScopeKind.Round => IsClosedForRoundAsync(scope.Id, cancellationToken),
            CampaignScopeResolver.ScopeKind.Assignment => IsClosedForAssignmentAsync(scope.Id, cancellationToken),
            CampaignScopeResolver.ScopeKind.CheckIn => IsClosedForCheckInAsync(scope.Id, cancellationToken),
            CampaignScopeResolver.ScopeKind.FollowUpAction => IsClosedForFollowUpActionAsync(scope.Id, cancellationToken),
            CampaignScopeResolver.ScopeKind.DiscussionSignal => IsClosedForDiscussionSignalAsync(scope.Id, cancellationToken),
            _ => Task.FromResult(false)
        };

    /// <summary>
    /// True when the campaign is closed and the write must be rejected. Resolves from the change
    /// tracker when the handler has already loaded the campaign, so the common case costs nothing.
    /// </summary>
    public async Task<bool> IsClosedAsync(Guid campaignId, CancellationToken cancellationToken)
    {
        var tracked = dbContext.ChangeTracker.Entries<Domain.Entities.PerformanceCycle>()
            .FirstOrDefault(entry => entry.Entity.Id == campaignId);
        if (tracked is not null)
        {
            return tracked.Entity.IsClosed;
        }

        return await dbContext.PerformanceCycles
            .AsNoTracking()
            .Where(campaign => campaign.Id == campaignId)
            .Select(campaign => campaign.Status)
            .FirstOrDefaultAsync(cancellationToken) == PerformanceCycleStatus.Closed;
    }

    /// <summary>Resolves the campaign behind an employee objective plan, then checks closure.</summary>
    public async Task<bool> IsClosedForPlanAsync(Guid planId, CancellationToken cancellationToken)
        => await IsClosedForCampaignOfAsync(
            dbContext.EmployeeObjectivePlans.Where(plan => plan.Id == planId).Select(plan => plan.CycleId),
            cancellationToken);

    /// <summary>
    /// Resolves the campaign behind an evaluation assignment via its round, then checks closure.
    /// </summary>
    public async Task<bool> IsClosedForAssignmentAsync(Guid assignmentId, CancellationToken cancellationToken)
        => await IsClosedForCampaignOfAsync(
            from assignment in dbContext.EvaluationAssignments
            where assignment.Id == assignmentId
            join round in dbContext.EvaluationRounds on assignment.RoundId equals round.Id
            select round.PerformanceCycleId,
            cancellationToken);

    /// <summary>Resolves the campaign behind a check-in, then checks closure.</summary>
    public async Task<bool> IsClosedForCheckInAsync(Guid checkInId, CancellationToken cancellationToken)
        => await IsClosedForCampaignOfAsync(
            dbContext.PerformanceCheckIns.Where(checkIn => checkIn.Id == checkInId).Select(checkIn => checkIn.CycleId),
            cancellationToken);

    /// <summary>Resolves the campaign behind an evaluation round, then checks closure.</summary>
    public async Task<bool> IsClosedForRoundAsync(Guid roundId, CancellationToken cancellationToken)
        => await IsClosedForCampaignOfAsync(
            dbContext.EvaluationRounds.Where(round => round.Id == roundId).Select(round => round.PerformanceCycleId),
            cancellationToken);

    /// <summary>Resolves the campaign behind a check-in follow-up action, then checks closure.</summary>
    public async Task<bool> IsClosedForFollowUpActionAsync(Guid actionId, CancellationToken cancellationToken)
        => await IsClosedForCampaignOfAsync(
            from action in dbContext.CheckInFollowUpActions
            where action.Id == actionId
            join checkIn in dbContext.PerformanceCheckIns on action.CheckInId equals checkIn.Id
            select checkIn.CycleId,
            cancellationToken);

    /// <summary>Resolves the campaign behind an objective discussion signal, then checks closure.</summary>
    public async Task<bool> IsClosedForDiscussionSignalAsync(Guid signalId, CancellationToken cancellationToken)
        => await IsClosedForCampaignOfAsync(
            dbContext.ObjectiveDiscussionSignals
                .Where(signal => signal.Id == signalId)
                .Select(signal => signal.CycleId),
            cancellationToken);

    /// <summary>
    /// A missing subject is not a closed campaign: the handler's own not-found path must own that
    /// outcome, so the guard stays silent rather than masking it with a closure error.
    /// </summary>
    private async Task<bool> IsClosedForCampaignOfAsync(
        IQueryable<Guid> campaignIdQuery,
        CancellationToken cancellationToken)
    {
        var campaignId = await campaignIdQuery.FirstOrDefaultAsync(cancellationToken);
        return campaignId != Guid.Empty && await IsClosedAsync(campaignId, cancellationToken);
    }
}
