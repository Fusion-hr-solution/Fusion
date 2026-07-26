using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.CheckIns.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CheckIns.Commands;

public sealed record CancelFollowUpActionCommand(Guid ActionId, CancelFollowUpActionRequest Request)
    : ICommand<Result<FollowUpActionMutationResult>>;

public sealed class CancelFollowUpActionCommandHandler(
    PerformanceDbContext dbContext,
    CheckInAccessGuard accessGuard) : ICommandHandler<CancelFollowUpActionCommand, Result<FollowUpActionMutationResult>>
{
    public async Task<Result<FollowUpActionMutationResult>> Handle(
        CancelFollowUpActionCommand request,
        CancellationToken cancellationToken)
    {
        var contextResult = await accessGuard.RequireReviewerActionAsync(request.ActionId, cancellationToken);
        if (contextResult.IsFailure)
            return Result.Failure<FollowUpActionMutationResult>(contextResult.Error);
        var context = contextResult.Value;
        var action = context.Action;

        if (action.Version != request.Request.ExpectedVersion)
            return Result.Failure<FollowUpActionMutationResult>(CheckInConflicts.ActionStale());

        try
        {
            action.Cancel(context.ReviewerId, context.ReviewerName, request.Request.Reason, DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<FollowUpActionMutationResult>(Error.Validation("CheckIn.ActionInvalid", exception.Message));
        }

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<FollowUpActionMutationResult>(CheckInConflicts.ActionStale());
        }

        return Result.Success(new FollowUpActionMutationResult(action.Id, action.Status, action.Version));
    }
}
