using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.CheckIns.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CheckIns.Commands;

public sealed record CancelCheckInCommand(Guid CheckInId, CancelCheckInRequest Request)
    : ICommand<Result<CheckInMutationResult>>;

public sealed class CancelCheckInCommandHandler(
    PerformanceDbContext dbContext,
    CheckInAccessGuard accessGuard) : ICommandHandler<CancelCheckInCommand, Result<CheckInMutationResult>>
{
    public async Task<Result<CheckInMutationResult>> Handle(
        CancelCheckInCommand request,
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
            checkIn.Cancel(request.Request.Reason, context.ReviewerId, context.ReviewerName, DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<CheckInMutationResult>(Error.Validation("CheckIn.Invalid", exception.Message));
        }

        // A linked, still-open discussion signal returns to Open so the attention queue stays truthful.
        var linkedSignals = await dbContext.ObjectiveDiscussionSignals
            .Where(item => item.LinkedCheckInId == checkIn.Id && item.Status == DiscussionSignalStatus.Open)
            .ToListAsync(cancellationToken);
        foreach (var signal in linkedSignals)
            signal.ReturnToOpen();

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
