using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.CheckIns.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CheckIns.Commands;

public sealed record CompleteFollowUpActionCommand(Guid ActionId, CompleteFollowUpActionRequest Request)
    : ICommand<Result<FollowUpActionMutationResult>>;

public sealed class CompleteFollowUpActionCommandHandler(
    PerformanceDbContext dbContext,
    CheckInAccessGuard accessGuard,
    ICurrentUserContext currentUser) : ICommandHandler<CompleteFollowUpActionCommand, Result<FollowUpActionMutationResult>>
{
    public async Task<Result<FollowUpActionMutationResult>> Handle(
        CompleteFollowUpActionCommand request,
        CancellationToken cancellationToken)
    {
        var actionResult = await accessGuard.RequireActionOwnerAsync(request.ActionId, cancellationToken);
        if (actionResult.IsFailure)
            return Result.Failure<FollowUpActionMutationResult>(actionResult.Error);
        var action = actionResult.Value;

        if (action.Version != request.Request.ExpectedVersion)
            return Result.Failure<FollowUpActionMutationResult>(CheckInConflicts.ActionStale());

        var actorName = string.IsNullOrWhiteSpace(currentUser.FullName) ? action.OwnerName : currentUser.FullName!;
        try
        {
            action.Complete(action.OwnerEmployeeId, actorName, request.Request.Note, DateTime.UtcNow);
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
