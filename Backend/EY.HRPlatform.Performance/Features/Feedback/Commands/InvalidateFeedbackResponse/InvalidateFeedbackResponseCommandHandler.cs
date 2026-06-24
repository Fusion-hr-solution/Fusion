using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Feedback.Commands.InvalidateFeedbackResponse;

public sealed class InvalidateFeedbackResponseCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser,
    IPerformanceAccessPolicyService accessPolicy,
    IHttpContextAccessor httpContextAccessor)
    : ICommandHandler<InvalidateFeedbackResponseCommand, Result>
{
    public async Task<Result> Handle(InvalidateFeedbackResponseCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure(Error.Forbidden("Feedback.EmployeeContextRequired",
                "An employee context is required to invalidate feedback."));

        var user = httpContextAccessor.HttpContext?.User;
        if (user is null || !accessPolicy.CanManageCycles(user))
            return Result.Failure(Error.Forbidden("Feedback.InsufficientPermissions",
                "Cycle management permission is required to invalidate feedback."));

        var content = await dbContext.FeedbackResponseContents.SingleOrDefaultAsync(
            item => item.Id == request.ResponseContentId, cancellationToken);
        if (content is null)
            return Result.Failure(Error.NotFound("FeedbackResponseContent", request.ResponseContentId));

        if (string.IsNullOrWhiteSpace(request.Reason))
            return Result.Failure(Error.Validation("Feedback.MissingReason",
                "An invalidation reason is required."));

        try
        {
            content.Invalidate(request.Reason);

            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                content.TenantId, content.CycleId, PerformanceCycleAuditAction.FeedbackResponseInvalidated,
                currentUser.UserId, currentUser.FullName,
                $"Feedback response invalidated: {request.Reason}."));

            await dbContext.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (DomainRuleViolationException exception)
        {
            return Result.Failure(Error.Conflict("Feedback.InvalidTransition", exception.Message));
        }
        catch (ArgumentException exception)
        {
            return Result.Failure(Error.Validation("Feedback.InvalidInput", exception.Message));
        }
    }
}
