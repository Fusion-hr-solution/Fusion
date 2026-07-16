using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.PlanApprovals.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.PlanApprovals.Commands;

public sealed record ApproveObjectivePlanCommand(Guid CycleId, Guid PlanId, uint ExpectedVersion)
    : ICommand<Result<PlanApprovalReviewDto>>;

public sealed class ApproveObjectivePlanCommandHandler(
    PerformanceDbContext dbContext,
    PlanApprovalAccessGuard accessGuard,
    ICurrentUserContext currentUser) : ICommandHandler<ApproveObjectivePlanCommand, Result<PlanApprovalReviewDto>>
{
    public async Task<Result<PlanApprovalReviewDto>> Handle(
        ApproveObjectivePlanCommand request,
        CancellationToken cancellationToken)
    {
        var scope = await accessGuard.RequirePlanApprovalScopeAsync(request.CycleId, request.PlanId, cancellationToken);
        if (scope.IsFailure)
            return Result.Failure<PlanApprovalReviewDto>(scope.Error);

        var plan = scope.Value.Plan;
        ConcurrencyGuard.Ensure(plan.Version, request.ExpectedVersion, nameof(EmployeeObjectivePlan), plan.Id);

        try
        {
            plan.Approve(
                new EmployeeObjectivePlanReviewActor(currentUser.EmployeeId!.Value, currentUser.FullName ?? "Manager"),
                DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<PlanApprovalReviewDto>(
                Error.Validation("PlanApproval.Invalid", exception.Message));
        }

        foreach (var entry in dbContext.ChangeTracker.Entries<EmployeeObjectivePlanReviewEvent>()
                     .Where(entry => entry.State == EntityState.Modified))
        {
            entry.State = EntityState.Added;
        }

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            plan.TenantId,
            plan.CycleId,
            PerformanceCycleAuditAction.EmployeeObjectivePlanApproved,
            currentUser.UserId,
            currentUser.FullName,
            $"Approved objective plan for '{scope.Value.Participant.FullName}'."));

        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success(PlanApprovalMapper.ToReviewDto(plan, scope.Value.Participant, false));
    }
}
