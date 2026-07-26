using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.CheckIns.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.CheckIns.Commands;

public sealed record CloseDiscussionSignalCommand(Guid SignalId, CloseDiscussionSignalRequest Request)
    : ICommand<Result<DiscussionSignalMutationResult>>;

public sealed class CloseDiscussionSignalCommandHandler(
    PerformanceDbContext dbContext,
    CheckInAccessGuard accessGuard) : ICommandHandler<CloseDiscussionSignalCommand, Result<DiscussionSignalMutationResult>>
{
    public async Task<Result<DiscussionSignalMutationResult>> Handle(
        CloseDiscussionSignalCommand request,
        CancellationToken cancellationToken)
    {
        var contextResult = await accessGuard.RequireReviewerSignalAsync(request.SignalId, cancellationToken);
        if (contextResult.IsFailure)
            return Result.Failure<DiscussionSignalMutationResult>(contextResult.Error);
        var context = contextResult.Value;
        var signal = context.Signal;

        try
        {
            signal.Close(context.ReviewerId, request.Request.Reason, DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<DiscussionSignalMutationResult>(Error.Validation("CheckIn.SignalInvalid", exception.Message));
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success(new DiscussionSignalMutationResult(signal.Id, signal.Status));
    }
}
