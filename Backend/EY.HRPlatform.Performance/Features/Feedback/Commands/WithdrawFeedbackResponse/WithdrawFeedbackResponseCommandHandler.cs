using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Feedback.Commands.WithdrawFeedbackResponse;

public sealed class WithdrawFeedbackResponseCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser)
    : ICommandHandler<WithdrawFeedbackResponseCommand, Result>
{
    public async Task<Result> Handle(WithdrawFeedbackResponseCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure(Error.Forbidden("Feedback.EmployeeContextRequired",
                "An employee context is required to withdraw feedback."));

        var content = await dbContext.FeedbackResponseContents.SingleOrDefaultAsync(
            item => item.Id == request.ResponseContentId, cancellationToken);
        if (content is null)
            return Result.Failure(Error.NotFound("FeedbackResponseContent", request.ResponseContentId));

        var mapping = await dbContext.FeedbackIdentityMappings.SingleOrDefaultAsync(
            item => item.ResponseContentId == content.Id, cancellationToken);
        if (mapping is null)
            return Result.Failure(Error.NotFound("FeedbackIdentityMapping", content.Id));

        if (mapping.ReviewerEmployeeId != currentUser.EmployeeId.Value)
            return Result.Failure(Error.Forbidden("Feedback.NotOwner",
                "Only the original reviewer can withdraw this feedback."));

        if (content.Status != FeedbackResponseStatus.Submitted)
            return Result.Failure(Error.Forbidden("Feedback.InvalidStatus",
                "Only a submitted response can be withdrawn."));

        try
        {
            content.Withdraw(DateTime.UtcNow);

            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                content.TenantId, content.CycleId, PerformanceCycleAuditAction.FeedbackResponseWithdrawn,
                currentUser.UserId, currentUser.FullName, "Feedback response withdrawn."));

            await dbContext.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (DomainRuleViolationException exception)
        {
            return Result.Failure(Error.Conflict("Feedback.InvalidTransition", exception.Message));
        }
    }
}
