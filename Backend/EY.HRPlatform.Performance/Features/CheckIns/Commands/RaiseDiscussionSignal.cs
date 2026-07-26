using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.CheckIns.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CheckIns.Commands;

public sealed record RaiseDiscussionSignalCommand(Guid CycleId, RaiseDiscussionSignalRequest Request)
    : ICommand<Result<DiscussionSignalMutationResult>>;

public sealed class RaiseDiscussionSignalCommandHandler(
    PerformanceDbContext dbContext,
    CheckInAccessGuard accessGuard,
    ICurrentUserContext currentUser) : ICommandHandler<RaiseDiscussionSignalCommand, Result<DiscussionSignalMutationResult>>
{
    public async Task<Result<DiscussionSignalMutationResult>> Handle(
        RaiseDiscussionSignalCommand request,
        CancellationToken cancellationToken)
    {
        var selfResult = accessGuard.RequireEmployeeSelf();
        if (selfResult.IsFailure)
            return Result.Failure<DiscussionSignalMutationResult>(selfResult.Error);
        var employeeId = selfResult.Value;

        var plan = await dbContext.EmployeeObjectivePlans
            .AsNoTracking()
            .Include(item => item.Objectives)
            .FirstOrDefaultAsync(
                item => item.CycleId == request.CycleId && item.EmployeeId == employeeId,
                cancellationToken);
        if (plan is null || plan.Status != PlanStatus.Approved)
            return Result.Failure<DiscussionSignalMutationResult>(Error.Validation(
                "CheckIn.SignalPlanNotApproved",
                "You can raise a discussion once your plan is approved."));

        var objective = plan.Objectives.FirstOrDefault(item => item.Id == request.Request.ObjectiveId);
        if (objective is null)
            return Result.Failure<DiscussionSignalMutationResult>(Error.NotFound("EmployeeObjective", request.Request.ObjectiveId));

        var existing = await dbContext.ObjectiveDiscussionSignals
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.CycleId == request.CycleId
                        && item.ObjectiveId == request.Request.ObjectiveId
                        && item.RaisedByEmployeeId == employeeId
                        && item.Status == DiscussionSignalStatus.Open,
                cancellationToken);
        if (existing is not null)
            return Result.Success(new DiscussionSignalMutationResult(existing.Id, existing.Status));

        ObjectiveDiscussionSignal signal;
        try
        {
            signal = ObjectiveDiscussionSignal.Raise(
                plan.TenantId,
                request.CycleId,
                plan.Id,
                objective.Id,
                employeeId,
                objective.Title,
                currentUser.FullName ?? string.Empty,
                request.Request.Note,
                DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<DiscussionSignalMutationResult>(Error.Validation("CheckIn.SignalInvalid", exception.Message));
        }

        dbContext.ObjectiveDiscussionSignals.Add(signal);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success(new DiscussionSignalMutationResult(signal.Id, signal.Status));
    }
}
