using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.CheckIns.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CheckIns.Commands;

public sealed record RescheduleCheckInCommand(Guid CheckInId, RescheduleCheckInRequest Request)
    : ICommand<Result<CheckInMutationResult>>;

public sealed class RescheduleCheckInCommandHandler(
    PerformanceDbContext dbContext,
    CheckInAccessGuard accessGuard) : ICommandHandler<RescheduleCheckInCommand, Result<CheckInMutationResult>>
{
    public async Task<Result<CheckInMutationResult>> Handle(
        RescheduleCheckInCommand request,
        CancellationToken cancellationToken)
    {
        var contextResult = await accessGuard.RequireReviewerCheckInAsync(request.CheckInId, cancellationToken);
        if (contextResult.IsFailure)
            return Result.Failure<CheckInMutationResult>(contextResult.Error);
        var context = contextResult.Value;
        var checkIn = context.CheckIn;

        if (checkIn.Version != request.Request.ExpectedVersion)
            return Result.Failure<CheckInMutationResult>(CheckInConflicts.Stale());

        try
        {
            checkIn.Reschedule(request.Request.NewDate, request.Request.NewTime, context.ReviewerId, context.ReviewerName, DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<CheckInMutationResult>(Error.Validation("CheckIn.Invalid", exception.Message));
        }

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<CheckInMutationResult>(CheckInConflicts.Stale());
        }

        return Result.Success(new CheckInMutationResult(checkIn.Id, checkIn.Status, checkIn.Version));
    }
}
