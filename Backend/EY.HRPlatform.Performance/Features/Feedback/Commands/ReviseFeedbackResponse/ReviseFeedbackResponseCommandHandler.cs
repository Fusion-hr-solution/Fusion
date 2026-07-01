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

namespace EY.HRPlatform.Performance.Features.Feedback.Commands.ReviseFeedbackResponse;

public sealed class ReviseFeedbackResponseCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser)
    : ICommandHandler<ReviseFeedbackResponseCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(ReviseFeedbackResponseCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure<Guid>(Error.Forbidden("Feedback.EmployeeContextRequired",
                "An employee context is required to revise feedback."));

        var content = await dbContext.FeedbackResponseContents.SingleOrDefaultAsync(
            item => item.Id == request.ResponseContentId, cancellationToken);
        if (content is null)
            return Result.Failure<Guid>(Error.NotFound("FeedbackResponseContent", request.ResponseContentId));

        // Load identity mapping to verify ownership (the ONE place identity mapping is read in a command handler)
        var mapping = await dbContext.FeedbackIdentityMappings.SingleOrDefaultAsync(
            item => item.ResponseContentId == content.Id, cancellationToken);
        if (mapping is null)
            return Result.Failure<Guid>(Error.NotFound("FeedbackIdentityMapping", content.Id));

        if (mapping.ReviewerEmployeeId != currentUser.EmployeeId.Value)
            return Result.Failure<Guid>(Error.Forbidden("Feedback.NotOwner",
                "Only the original reviewer can revise this feedback."));

        if (content.Status != FeedbackResponseStatus.Submitted)
            return Result.Failure<Guid>(Error.Forbidden("Feedback.InvalidStatus",
                "Only a submitted response can be revised."));

        // Load template for required prompt validation
        var template = await dbContext.FeedbackTemplateSnapshots
            .Include(t => t.Prompts)
            .SingleOrDefaultAsync(t => t.Id == content.TemplateSnapshotId, cancellationToken);
        if (template is null)
            return Result.Failure<Guid>(Error.Conflict("Feedback.TemplateMissing",
                "The feedback template is no longer available."));

        // Validate required prompts
        var requiredPromptIds = template.Prompts.Where(p => p.IsRequired).Select(p => p.Id).ToHashSet();
        var answeredPromptIds = request.Answers.Select(a => a.PromptSnapshotId).ToHashSet();
        if (requiredPromptIds.Any(id => !answeredPromptIds.Contains(id)))
            return Result.Failure<Guid>(Error.Validation("Feedback.MissingRequiredPrompts",
                "All required prompts must be answered."));

        try
        {
            // Create new FeedbackResponseVersion (append-only, D-14)
            var latestVersion = await dbContext.FeedbackResponseVersions
                .Where(v => v.ResponseContentId == content.Id)
                .MaxAsync(v => (int?)v.VersionNumber, cancellationToken) ?? 0;

            var answersJson = JsonSerializer.Serialize(request.Answers);
            var version = FeedbackResponseVersion.Create(
                content.TenantId,
                content.Id,
                latestVersion + 1,
                answersJson,
                request.GeneralComment,
                currentUser.EmployeeId.Value);

            // Update content answers (latest version is active)
            var newAnswers = request.Answers.Select(a =>
            {
                var prompt = template.Prompts.First(p => p.Id == a.PromptSnapshotId);
                return FeedbackPromptAnswer.Create(
                    content.TenantId,
                    content.Id,
                    a.PromptSnapshotId,
                    prompt.PromptText,
                    prompt.Version,
                    a.AnswerText,
                    prompt.IsRequired);
            }).ToList();
            content.UpdateAnswers(newAnswers);

            dbContext.FeedbackResponseVersions.Add(version);
            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                content.TenantId, content.CycleId, PerformanceCycleAuditAction.FeedbackResponseSubmitted,
                currentUser.UserId, currentUser.FullName, "Feedback response revised."));

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
