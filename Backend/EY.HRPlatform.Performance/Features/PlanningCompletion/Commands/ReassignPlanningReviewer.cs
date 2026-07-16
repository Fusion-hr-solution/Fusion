using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.PlanningCompletion.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.PlanningCompletion.Commands;

public sealed record ReassignPlanningReviewerCommand(
    Guid CycleId,
    Guid ParticipantEmployeeId,
    ReassignPlanningReviewerRequest Request) : ICommand<Result<PlanningCompletionParticipantDetailDto>>;

public sealed class ReassignPlanningReviewerCommandHandler(
    PerformanceDbContext dbContext,
    PlanningCompletionReadService readService,
    ICoreWorkforceClient workforceClient,
    ICurrentUserContext currentUser)
    : ICommandHandler<ReassignPlanningReviewerCommand, Result<PlanningCompletionParticipantDetailDto>>
{
    public async Task<Result<PlanningCompletionParticipantDetailDto>> Handle(
        ReassignPlanningReviewerCommand request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Request.Reason))
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.Validation("PlanningCompletion.ReassignmentReasonRequired", "A reassignment reason is required."));
        if (request.Request.NewApproverEmployeeId == Guid.Empty)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.Validation("PlanningCompletion.ReviewerRequired", "Choose a reviewer."));

        var cycle = await dbContext.PerformanceCycles
            .FirstOrDefaultAsync(item => item.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        if (cycle.Status != PerformanceCycleStatus.Launched)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.Validation("PlanningCompletion.NotLaunchedInvalid", "Planning completion starts after campaign launch."));
        if (cycle.IsPlanningLocked)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.Conflict("PlanningCompletion.Locked", "Planning is locked for this campaign."));

        var participant = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.CycleId == request.CycleId && item.EmployeeId == request.ParticipantEmployeeId,
                cancellationToken);
        if (participant is null)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.NotFound("PerformanceCycleParticipant", request.ParticipantEmployeeId));

        var resolved = await workforceClient.ResolveEmployeesAsync([request.Request.NewApproverEmployeeId], cancellationToken);
        var newApprover = resolved.FirstOrDefault(item => item.EmployeeId == request.Request.NewApproverEmployeeId);
        if (newApprover is null || !newApprover.IsActive)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.Validation("PlanningCompletion.InvalidReviewer", "Choose an active employee in this tenant."));

        var latest = await dbContext.PerformanceCycleApproverReassignments
            .AsNoTracking()
            .Where(item => item.CycleId == request.CycleId && item.ParticipantEmployeeId == request.ParticipantEmployeeId)
            .OrderByDescending(item => item.ReassignedAt)
            .FirstOrDefaultAsync(cancellationToken);

        var previousReviewerId = latest?.NewApproverEmployeeId ?? participant.ApproverEmployeeId;
        var previousReviewerName = latest?.NewApproverName ?? participant.ApproverName;
        var approverName = string.IsNullOrWhiteSpace(newApprover.DisplayName)
            ? newApprover.FullName
            : newApprover.DisplayName;

        var reassignment = PerformanceCycleApproverReassignment.Create(
            cycle.TenantId,
            cycle.Id,
            participant.EmployeeId,
            previousReviewerId,
            previousReviewerName,
            newApprover.EmployeeId,
            approverName,
            request.Request.Reason,
            currentUser.UserId,
            currentUser.FullName,
            DateTime.UtcNow);

        dbContext.PerformanceCycleApproverReassignments.Add(reassignment);
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            cycle.TenantId,
            cycle.Id,
            PerformanceCycleAuditAction.PlanningApproverReassigned,
            currentUser.UserId,
            currentUser.FullName,
            $"Reassigned planning reviewer for '{participant.FullName}' to '{approverName}'.",
            correlationId: currentUser.CorrelationId));

        await dbContext.SaveChangesAsync(cancellationToken);
        return await readService.GetParticipantDetailAsync(cycle.Id, participant.EmployeeId, cancellationToken);
    }
}
