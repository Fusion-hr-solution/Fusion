using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.EmployeeObjectives.Commands;

public sealed record SubmitObjectivePlanCommand(Guid CycleId, uint ExpectedVersion)
    : ICommand<Result<SubmitObjectivePlanResponseDto>>;

public sealed class SubmitObjectivePlanCommandHandler(
    PerformanceDbContext dbContext,
    EmployeeObjectivePlanAccessGuard accessGuard,
    ICurrentUserContext currentUser) : ICommandHandler<SubmitObjectivePlanCommand, Result<SubmitObjectivePlanResponseDto>>
{
    public async Task<Result<SubmitObjectivePlanResponseDto>> Handle(
        SubmitObjectivePlanCommand request,
        CancellationToken cancellationToken)
    {
        var participantResult = await accessGuard.RequireParticipantAsync(request.CycleId, cancellationToken);
        if (participantResult.IsFailure)
            return Result.Failure<SubmitObjectivePlanResponseDto>(participantResult.Error);

        var cycle = await dbContext.PerformanceCycles
            .FirstOrDefaultAsync(item => item.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<SubmitObjectivePlanResponseDto>(Error.NotFound("PerformanceCycle", request.CycleId));

        var plan = await dbContext.EmployeeObjectivePlans
            .Include(item => item.Objectives)
            .Include(item => item.ReviewEvents)
            .FirstOrDefaultAsync(
                item => item.CycleId == request.CycleId && item.EmployeeId == participantResult.Value.EmployeeId,
                cancellationToken);
        if (plan is null)
            return Result.Failure<SubmitObjectivePlanResponseDto>(Error.NotFound("EmployeeObjectivePlan", request.CycleId));

        ConcurrencyGuard.Ensure(plan.Version, request.ExpectedVersion, nameof(EmployeeObjectivePlan), plan.Id);

        var wasChangesRequested = plan.Status == PlanStatus.ChangesRequested;
        ObjectivePlanSubmissionResult submission;
        try
        {
            submission = plan.Submit(cycle, participantResult.Value, DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<SubmitObjectivePlanResponseDto>(
                Error.Validation("EmployeeObjectivePlan.Invalid", exception.Message));
        }

        if (!submission.Succeeded)
        {
            return Result.Success(new SubmitObjectivePlanResponseDto(
                false,
                EmployeeObjectivePlanMapper.ToPlanDto(plan),
                submission.BlockingReasons
                    .Select(reason => new ObjectivePlanBlockingReasonDto(reason.Code, reason.Message, reason.ObjectiveId))
                    .ToList()));
        }

        foreach (var entry in dbContext.ChangeTracker.Entries<EmployeeObjectivePlanReviewEvent>()
                     .Where(entry => entry.State == EntityState.Modified))
        {
            entry.State = EntityState.Added;
        }

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            plan.TenantId,
            plan.CycleId,
            wasChangesRequested
                ? PerformanceCycleAuditAction.EmployeeObjectivePlanResubmitted
                : PerformanceCycleAuditAction.EmployeeObjectivePlanSubmitted,
            currentUser.UserId,
            currentUser.FullName,
            wasChangesRequested
                ? "Resubmitted employee objective plan."
                : "Submitted employee objective plan."));

        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success(new SubmitObjectivePlanResponseDto(
            true,
            EmployeeObjectivePlanMapper.ToPlanDto(plan),
            []));
    }
}
