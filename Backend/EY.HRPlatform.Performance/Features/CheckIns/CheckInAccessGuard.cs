using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CheckIns;

/// <summary>
/// Central authorization for the check-in workflow. The reviewer paths resolve the single
/// effective-reviewer rule (frozen approver overridden by the latest reassignment — never live Core
/// reporting lines) and enforce it per participant, hide-don't-deny. The employee paths are strictly
/// self-scoped. Every path resolves the participant/record first and returns not-found/forbidden for
/// out-of-scope ids rather than leaking existence.
/// </summary>
public sealed class CheckInAccessGuard(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser)
{
    /// <summary>
    /// Resolves the reviewer scope for planning a new check-in for a participant: the caller must be
    /// the participant's current effective reviewer on a launched, planning-locked campaign whose
    /// plan is Approved and who is not excluded.
    /// </summary>
    public async Task<Result<CheckInPlanScope>> RequirePlanScopeAsync(
        Guid cycleId,
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        var reviewerEmployeeId = currentUser.EmployeeId;
        if (!reviewerEmployeeId.HasValue)
            return Result.Failure<CheckInPlanScope>(Error.Forbidden(
                "CheckIn.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));

        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == cycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<CheckInPlanScope>(Error.NotFound("PerformanceCycle", cycleId));

        if (cycle.Status != PerformanceCycleStatus.Launched || !cycle.IsPlanningLocked)
            return Result.Failure<CheckInPlanScope>(Error.Validation(
                "CheckIn.CampaignNotReady",
                "Check-ins open once campaign planning is locked."));

        var participant = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.CycleId == cycleId && item.EmployeeId == employeeId, cancellationToken);
        if (participant is null)
            return Result.Failure<CheckInPlanScope>(Error.NotFound("PerformanceCycleParticipant", employeeId));

        var excluded = await dbContext.PerformanceCycleParticipantExclusions
            .AsNoTracking()
            .AnyAsync(item => item.CycleId == cycleId && item.ParticipantEmployeeId == employeeId, cancellationToken);
        if (excluded)
            return Result.Failure<CheckInPlanScope>(Error.Validation(
                "CheckIn.ParticipantExcluded",
                "This participant was excluded from the campaign, so no check-in can be planned."));

        var reviewer = await ResolveEffectiveReviewerAsync(cycleId, participant, cancellationToken);
        if (reviewer.ReviewerId != reviewerEmployeeId.Value)
            return Result.Failure<CheckInPlanScope>(Error.Forbidden(
                "CheckIn.NotReviewerForbidden",
                "Only the participant's assigned reviewer can plan a check-in."));

        var plan = await dbContext.EmployeeObjectivePlans
            .AsNoTracking()
            .Include(item => item.Objectives)
            .FirstOrDefaultAsync(item => item.CycleId == cycleId && item.EmployeeId == employeeId, cancellationToken);
        if (plan is null || plan.Status != PlanStatus.Approved)
            return Result.Failure<CheckInPlanScope>(Error.Validation(
                "CheckIn.PlanNotApproved",
                "A check-in can only be planned once the participant's plan is approved."));

        return Result.Success(new CheckInPlanScope(
            cycle, participant, plan, reviewer.ReviewerId, reviewer.ReviewerName, reviewer.Relationship));
    }

    /// <summary>
    /// Resolves reviewer scope for reading a participant's check-in panel: the caller must be the
    /// participant's current effective reviewer. Unlike the plan path, this does not require the plan
    /// to be Approved, so a reviewer can always monitor a participant they review.
    /// </summary>
    public async Task<Result<CheckInReviewerParticipantScope>> RequireReviewerParticipantAsync(
        Guid cycleId,
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        var reviewerEmployeeId = currentUser.EmployeeId;
        if (!reviewerEmployeeId.HasValue)
            return Result.Failure<CheckInReviewerParticipantScope>(Error.Forbidden(
                "CheckIn.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));

        var participant = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.CycleId == cycleId && item.EmployeeId == employeeId, cancellationToken);
        if (participant is null)
            return Result.Failure<CheckInReviewerParticipantScope>(Error.NotFound("PerformanceCycleParticipant", employeeId));

        var reviewer = await ResolveEffectiveReviewerAsync(cycleId, participant, cancellationToken);
        if (reviewer.ReviewerId != reviewerEmployeeId.Value)
            return Result.Failure<CheckInReviewerParticipantScope>(Error.Forbidden(
                "CheckIn.NotReviewerForbidden",
                "Only the participant's assigned reviewer can view their check-ins."));

        return Result.Success(new CheckInReviewerParticipantScope(participant, reviewer.ReviewerId, reviewer.ReviewerName));
    }

    /// <summary>
    /// Loads a tracked check-in for a reviewer mutation (reschedule/cancel/complete/addendum),
    /// enforcing that the caller is the participant's current effective reviewer.
    /// </summary>
    public async Task<Result<CheckInReviewerContext>> RequireReviewerCheckInAsync(
        Guid checkInId,
        CancellationToken cancellationToken)
    {
        var reviewerEmployeeId = currentUser.EmployeeId;
        if (!reviewerEmployeeId.HasValue)
            return Result.Failure<CheckInReviewerContext>(Error.Forbidden(
                "CheckIn.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));

        var checkIn = await dbContext.PerformanceCheckIns
            .Include(item => item.LinkedObjectives)
            .FirstOrDefaultAsync(item => item.Id == checkInId, cancellationToken);
        if (checkIn is null)
            return Result.Failure<CheckInReviewerContext>(Error.NotFound("PerformanceCheckIn", checkInId));

        var participant = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.CycleId == checkIn.CycleId && item.EmployeeId == checkIn.EmployeeId,
                cancellationToken);
        if (participant is null)
            return Result.Failure<CheckInReviewerContext>(Error.NotFound("PerformanceCycleParticipant", checkIn.EmployeeId));

        var reviewer = await ResolveEffectiveReviewerAsync(checkIn.CycleId, participant, cancellationToken);
        if (reviewer.ReviewerId != reviewerEmployeeId.Value)
            return Result.Failure<CheckInReviewerContext>(Error.Forbidden(
                "CheckIn.NotReviewerForbidden",
                "Only the participant's assigned reviewer can act on this check-in."));

        return Result.Success(new CheckInReviewerContext(checkIn, reviewer.ReviewerId, reviewer.ReviewerName));
    }

    /// <summary>Loads a tracked check-in for the employee's own response, enforcing self-scope.</summary>
    public async Task<Result<PerformanceCheckIn>> RequireEmployeeCheckInAsync(
        Guid checkInId,
        CancellationToken cancellationToken)
    {
        var employeeId = currentUser.EmployeeId;
        if (!employeeId.HasValue)
            return Result.Failure<PerformanceCheckIn>(Error.Forbidden(
                "CheckIn.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));

        var checkIn = await dbContext.PerformanceCheckIns
            .FirstOrDefaultAsync(item => item.Id == checkInId, cancellationToken);
        if (checkIn is null || checkIn.EmployeeId != employeeId.Value)
            return Result.Failure<PerformanceCheckIn>(Error.NotFound("PerformanceCheckIn", checkInId));

        return Result.Success(checkIn);
    }

    /// <summary>Resolves the current employee identity for self-scoped reads and signal raising.</summary>
    public Result<Guid> RequireEmployeeSelf()
    {
        var employeeId = currentUser.EmployeeId;
        if (!employeeId.HasValue)
            return Result.Failure<Guid>(Error.Forbidden(
                "CheckIn.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));
        return Result.Success(employeeId.Value);
    }

    /// <summary>Loads a tracked follow-up action whose owner is the caller (owner completes their own).</summary>
    public async Task<Result<CheckInFollowUpAction>> RequireActionOwnerAsync(
        Guid actionId,
        CancellationToken cancellationToken)
    {
        var employeeId = currentUser.EmployeeId;
        if (!employeeId.HasValue)
            return Result.Failure<CheckInFollowUpAction>(Error.Forbidden(
                "CheckIn.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));

        var action = await dbContext.CheckInFollowUpActions
            .Include(item => item.StatusEvents)
            .FirstOrDefaultAsync(item => item.Id == actionId, cancellationToken);
        if (action is null || action.OwnerEmployeeId != employeeId.Value)
            return Result.Failure<CheckInFollowUpAction>(Error.NotFound("CheckInFollowUpAction", actionId));

        return Result.Success(action);
    }

    /// <summary>Loads a tracked follow-up action for the participant's current effective reviewer (reviewer cancels).</summary>
    public async Task<Result<CheckInReviewerActionContext>> RequireReviewerActionAsync(
        Guid actionId,
        CancellationToken cancellationToken)
    {
        var reviewerEmployeeId = currentUser.EmployeeId;
        if (!reviewerEmployeeId.HasValue)
            return Result.Failure<CheckInReviewerActionContext>(Error.Forbidden(
                "CheckIn.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));

        var action = await dbContext.CheckInFollowUpActions
            .Include(item => item.StatusEvents)
            .FirstOrDefaultAsync(item => item.Id == actionId, cancellationToken);
        if (action is null)
            return Result.Failure<CheckInReviewerActionContext>(Error.NotFound("CheckInFollowUpAction", actionId));

        var participant = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.CycleId == action.CycleId && item.EmployeeId == action.EmployeeId,
                cancellationToken);
        if (participant is null)
            return Result.Failure<CheckInReviewerActionContext>(Error.NotFound("PerformanceCycleParticipant", action.EmployeeId));

        var reviewer = await ResolveEffectiveReviewerAsync(action.CycleId, participant, cancellationToken);
        if (reviewer.ReviewerId != reviewerEmployeeId.Value)
            return Result.Failure<CheckInReviewerActionContext>(Error.Forbidden(
                "CheckIn.NotReviewerForbidden",
                "Only the participant's assigned reviewer can cancel this action."));

        return Result.Success(new CheckInReviewerActionContext(action, reviewer.ReviewerId, reviewer.ReviewerName));
    }

    /// <summary>Loads a tracked discussion signal for the participant's current effective reviewer (reviewer closes).</summary>
    public async Task<Result<CheckInReviewerSignalContext>> RequireReviewerSignalAsync(
        Guid signalId,
        CancellationToken cancellationToken)
    {
        var reviewerEmployeeId = currentUser.EmployeeId;
        if (!reviewerEmployeeId.HasValue)
            return Result.Failure<CheckInReviewerSignalContext>(Error.Forbidden(
                "CheckIn.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));

        var signal = await dbContext.ObjectiveDiscussionSignals
            .FirstOrDefaultAsync(item => item.Id == signalId, cancellationToken);
        if (signal is null)
            return Result.Failure<CheckInReviewerSignalContext>(Error.NotFound("ObjectiveDiscussionSignal", signalId));

        var participant = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.CycleId == signal.CycleId && item.EmployeeId == signal.RaisedByEmployeeId,
                cancellationToken);
        if (participant is null)
            return Result.Failure<CheckInReviewerSignalContext>(Error.NotFound("PerformanceCycleParticipant", signal.RaisedByEmployeeId));

        var reviewer = await ResolveEffectiveReviewerAsync(signal.CycleId, participant, cancellationToken);
        if (reviewer.ReviewerId != reviewerEmployeeId.Value)
            return Result.Failure<CheckInReviewerSignalContext>(Error.Forbidden(
                "CheckIn.NotReviewerForbidden",
                "Only the participant's assigned reviewer can resolve this discussion signal."));

        return Result.Success(new CheckInReviewerSignalContext(signal, reviewer.ReviewerId, reviewer.ReviewerName));
    }

    /// <summary>
    /// Resolves the effective reviewer identity, display name, and relationship for a participant,
    /// mirroring the frozen-approver-overridden-by-reassignment rule used across the module.
    /// </summary>
    private async Task<EffectiveReviewer> ResolveEffectiveReviewerAsync(
        Guid cycleId,
        PerformanceCycleParticipant participant,
        CancellationToken cancellationToken)
    {
        var latestReassignment = await dbContext.PerformanceCycleApproverReassignments
            .AsNoTracking()
            .Where(item => item.CycleId == cycleId && item.ParticipantEmployeeId == participant.EmployeeId)
            .OrderByDescending(item => item.ReassignedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return latestReassignment is not null
            ? new EffectiveReviewer(latestReassignment.NewApproverEmployeeId, latestReassignment.NewApproverName, "Reassigned")
            : new EffectiveReviewer(participant.ApproverEmployeeId, participant.ApproverName, "Approver");
    }

    private sealed record EffectiveReviewer(Guid ReviewerId, string ReviewerName, string Relationship);
}

public sealed record CheckInPlanScope(
    PerformanceCycle Cycle,
    PerformanceCycleParticipant Participant,
    EmployeeObjectivePlan Plan,
    Guid ReviewerId,
    string ReviewerName,
    string Relationship);

public sealed record CheckInReviewerContext(
    PerformanceCheckIn CheckIn,
    Guid ReviewerId,
    string ReviewerName);

public sealed record CheckInReviewerActionContext(
    CheckInFollowUpAction Action,
    Guid ReviewerId,
    string ReviewerName);

public sealed record CheckInReviewerSignalContext(
    ObjectiveDiscussionSignal Signal,
    Guid ReviewerId,
    string ReviewerName);

public sealed record CheckInReviewerParticipantScope(
    PerformanceCycleParticipant Participant,
    Guid ReviewerId,
    string ReviewerName);
