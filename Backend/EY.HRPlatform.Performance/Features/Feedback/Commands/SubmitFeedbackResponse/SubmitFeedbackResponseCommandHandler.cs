using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Feedback.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Feedback.Commands.SubmitFeedbackResponse;

public sealed class SubmitFeedbackResponseCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser)
    : ICommandHandler<SubmitFeedbackResponseCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(SubmitFeedbackResponseCommand request, CancellationToken cancellationToken)
    {
        // 1. Validate employee context
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure<Guid>(Error.Forbidden("Feedback.EmployeeContextRequired",
                "An employee context is required to submit feedback."));

        // 2. Load CampaignWorkItem
        var workItem = await dbContext.CampaignWorkItems.SingleOrDefaultAsync(
            item => item.Id == request.WorkItemId, cancellationToken);
        if (workItem is null)
            return Result.Failure<Guid>(Error.NotFound("CampaignWorkItem", request.WorkItemId));

        // 3. Validate work item type is PeerFeedback or UpwardFeedback
        if (workItem.Type is not (CampaignWorkItemType.PeerFeedback or CampaignWorkItemType.UpwardFeedback))
            return Result.Failure<Guid>(Error.Forbidden("Feedback.InvalidWorkItemType",
                "This work item is not a feedback work item."));

        // 4. Validate work item ownership
        if (workItem.AssigneeEmployeeId != currentUser.EmployeeId.Value)
            return Result.Failure<Guid>(Error.Forbidden("Feedback.NotAssigned",
                "The current employee is not assigned this feedback work item."));

        // 5. Prevent self-feedback
        if (workItem.SubjectEmployeeId == currentUser.EmployeeId.Value)
            return Result.Failure<Guid>(Error.Validation("Feedback.SelfFeedback",
                "You cannot submit feedback on yourself."));

        // 6. Check no existing response for this work item
        if (await dbContext.FeedbackResponseContents.AnyAsync(
            item => item.CycleId == workItem.CycleId &&
                    item.SubjectEmployeeId == workItem.SubjectEmployeeId &&
                    item.FeedbackType == workItem.Type, cancellationToken))
            return Result.Failure<Guid>(Error.Conflict("Feedback.AlreadySubmitted",
                "A feedback response already exists for this work item."));

        // 7. Load FeedbackTemplateSnapshot for cycle + type
        var responseType = workItem.Type == CampaignWorkItemType.PeerFeedback
            ? FeedbackResponseType.Peer
            : FeedbackResponseType.Upward;
        var template = await dbContext.FeedbackTemplateSnapshots
            .Include(t => t.Prompts)
            .SingleOrDefaultAsync(
                t => t.CycleId == workItem.CycleId && t.FeedbackType == responseType,
                cancellationToken);
        if (template is null)
            return Result.Failure<Guid>(Error.Conflict("Feedback.TemplateMissing",
                "No feedback template exists for this cycle and type."));

        // 8. Validate required prompts answered
        var requiredPromptIds = template.Prompts
            .Where(p => p.IsRequired)
            .Select(p => p.Id)
            .ToHashSet();
        var answeredPromptIds = request.Answers
            .Select(a => a.PromptSnapshotId)
            .ToHashSet();
        if (requiredPromptIds.Any(id => !answeredPromptIds.Contains(id)))
            return Result.Failure<Guid>(Error.Validation("Feedback.MissingRequiredPrompts",
                "All required prompts must be answered."));

        try
        {
            // 9. Create FeedbackResponseContent
            var content = FeedbackResponseContent.Create(
                workItem.TenantId,
                workItem.CycleId,
                workItem.SubjectEmployeeId,
                workItem.Type,
                template.Id,
                request.Answers.Select(a =>
                {
                    var prompt = template.Prompts.First(p => p.Id == a.PromptSnapshotId);
                    return new FeedbackPromptAnswerInput(
                        a.PromptSnapshotId,
                        prompt.PromptText,
                        prompt.Version,
                        a.AnswerText,
                        prompt.IsRequired);
                }));

            // 10. Transition to Submitted
            content.Submit(DateTime.UtcNow);

            // 11. Create FeedbackIdentityMapping
            var identityMapping = FeedbackIdentityMapping.Create(
                workItem.TenantId,
                content.Id,
                workItem.Id,
                currentUser.EmployeeId.Value);

            // 12. Create FeedbackResponseVersion (version 1)
            var answersJson = JsonSerializer.Serialize(request.Answers);
            var version = FeedbackResponseVersion.Create(
                workItem.TenantId,
                content.Id,
                1,
                answersJson,
                request.GeneralComment,
                currentUser.EmployeeId.Value);

            // 13. Transition CampaignWorkItem
            workItem.Submit(DateTime.UtcNow);

            // 14. Emit audit event
            dbContext.FeedbackResponseContents.Add(content);
            dbContext.FeedbackIdentityMappings.Add(identityMapping);
            dbContext.FeedbackResponseVersions.Add(version);
            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                workItem.TenantId, workItem.CycleId, PerformanceCycleAuditAction.FeedbackResponseSubmitted,
                currentUser.UserId, currentUser.FullName,
                $"{responseType} feedback response submitted."));

            // 15. SaveChanges
            await dbContext.SaveChangesAsync(cancellationToken);
            return content.Id;
        }
        catch (DomainRuleViolationException exception)
        {
            return Result.Failure<Guid>(Error.Conflict("Feedback.InvalidTransition", exception.Message));
        }
        catch (ArgumentException exception)
        {
            return Result.Failure<Guid>(Error.Validation("Feedback.InvalidInput", exception.Message));
        }
    }
}
