using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Feedback.Commands.ConfigureFeedbackTemplate;

public sealed class ConfigureFeedbackTemplateCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser)
    : ICommandHandler<ConfigureFeedbackTemplateCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(ConfigureFeedbackTemplateCommand request, CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles.SingleOrDefaultAsync(
            item => item.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<Guid>(Error.NotFound("PerformanceCycle", request.CycleId));

        if (!cycle.IsEditable)
            return Result.Failure<Guid>(Error.Forbidden("Feedback.TemplateFrozen",
                "Feedback templates cannot be changed after campaign preparation starts."));

        if (!Enum.TryParse<CampaignWorkItemType>(request.FeedbackType, ignoreCase: true, out var feedbackType) ||
            feedbackType is not (CampaignWorkItemType.PeerFeedback or CampaignWorkItemType.UpwardFeedback))
            return Result.Failure<Guid>(Error.Validation("Feedback.InvalidFeedbackType",
                "Feedback type must be PeerFeedback or UpwardFeedback."));

        var responseType = feedbackType == CampaignWorkItemType.PeerFeedback
            ? FeedbackResponseType.Peer
            : FeedbackResponseType.Upward;
        var existing = await dbContext.FeedbackTemplateSnapshots.SingleOrDefaultAsync(
            item => item.CycleId == cycle.Id && item.FeedbackType == responseType,
            cancellationToken);
        if (existing is not null)
            return Result.Failure<Guid>(Error.Conflict("Feedback.TemplateAlreadyExists",
                "A feedback template already exists for this cycle and type."));

        try
        {
            var snapshot = FeedbackTemplateSnapshot.Create(
                cycle.TenantId,
                cycle.Id,
                responseType,
                request.Name,
                request.Prompts.Select(p => new FeedbackPromptDefinition(p.PromptText, p.Description, p.IsRequired, p.DisplayOrder)),
                DateTime.UtcNow);

            dbContext.FeedbackTemplateSnapshots.Add(snapshot);
            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                cycle.TenantId, cycle.Id, PerformanceCycleAuditAction.GovernanceConfigured,
                currentUser.UserId, currentUser.FullName,
                $"Feedback template configured: {request.FeedbackType}."));

            await dbContext.SaveChangesAsync(cancellationToken);
            return snapshot.Id;
        }
        catch (ArgumentException exception)
        {
            return Result.Failure<Guid>(Error.Validation("Feedback.InvalidTemplate", exception.Message));
        }
    }
}
