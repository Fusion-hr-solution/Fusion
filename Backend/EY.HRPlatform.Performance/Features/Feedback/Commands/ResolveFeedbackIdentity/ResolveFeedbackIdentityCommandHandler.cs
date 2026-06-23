using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Feedback.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Feedback.Commands.ResolveFeedbackIdentity;

public sealed class ResolveFeedbackIdentityCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser,
    IPerformanceAccessPolicyService accessPolicy,
    IHttpContextAccessor httpContextAccessor)
    : ICommandHandler<ResolveFeedbackIdentityCommand, Result<FeedbackIdentityDto>>
{
    public async Task<Result<FeedbackIdentityDto>> Handle(
        ResolveFeedbackIdentityCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure<FeedbackIdentityDto>(Error.Forbidden("Feedback.EmployeeContextRequired",
                "An employee context is required to resolve feedback identity."));

        // D-07/D-10: Requires ConfidentialIdentityView permission
        var user = httpContextAccessor.HttpContext?.User;
        if (user is null || !accessPolicy.CanAccessConfidentialFeedbackIdentity(user))
            return Result.Failure<FeedbackIdentityDto>(Error.Forbidden("Feedback.IdentityAccessDenied",
                "Confidential identity view permission is required."));

        var mapping = await dbContext.FeedbackIdentityMappings.SingleOrDefaultAsync(
            item => item.ResponseContentId == request.ResponseContentId, cancellationToken);
        if (mapping is null)
            return Result.Failure<FeedbackIdentityDto>(Error.NotFound("FeedbackIdentityMapping",
                request.ResponseContentId));

        // Emit audit event (D-19)
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            mapping.TenantId, Guid.Empty, PerformanceCycleAuditAction.FeedbackIdentityAccessed,
            currentUser.UserId, currentUser.FullName,
            $"Feedback identity accessed. Reason: {request.Reason}."));

        await dbContext.SaveChangesAsync(cancellationToken);

        return new FeedbackIdentityDto(mapping.WorkItemId, mapping.ReviewerEmployeeId);
    }
}
