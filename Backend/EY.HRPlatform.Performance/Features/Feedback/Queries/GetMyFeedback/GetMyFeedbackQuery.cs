using EY.HRPlatform.Performance.Features.Feedback.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Feedback.Queries.GetMyFeedback;

public sealed record GetMyFeedbackQuery(Guid WorkItemId) : IQuery<Result<FeedbackResponseItemDto>>;

public sealed class GetMyFeedbackQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser)
    : IQueryHandler<GetMyFeedbackQuery, Result<FeedbackResponseItemDto>>
{
    public async Task<Result<FeedbackResponseItemDto>> Handle(
        GetMyFeedbackQuery request,
        CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
        {
            return Result.Failure<FeedbackResponseItemDto>(
                Error.Forbidden(
                    "Feedback.EmployeeContextRequired",
                    "An employee context is required to read your feedback response."));
        }

        var workItem = await dbContext.CampaignWorkItems
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == request.WorkItemId, cancellationToken);
        if (workItem is null)
        {
            return Result.Failure<FeedbackResponseItemDto>(
                Error.NotFound("CampaignWorkItem", request.WorkItemId));
        }

        if (workItem.Type is not (CampaignWorkItemType.PeerFeedback or CampaignWorkItemType.UpwardFeedback))
        {
            return Result.Failure<FeedbackResponseItemDto>(
                Error.Forbidden("Feedback.InvalidWorkItemType", "This work item is not a feedback work item."));
        }

        if (workItem.AssigneeEmployeeId != currentUser.EmployeeId.Value)
        {
            return Result.Failure<FeedbackResponseItemDto>(
                Error.Forbidden("Feedback.NotAssigned", "The current employee is not assigned this feedback work item."));
        }

        var mapping = await dbContext.FeedbackIdentityMappings
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.WorkItemId == request.WorkItemId
                    && item.ReviewerEmployeeId == currentUser.EmployeeId.Value,
                cancellationToken);
        if (mapping is null)
        {
            return Result.Failure<FeedbackResponseItemDto>(
                Error.NotFound("FeedbackIdentityMapping", request.WorkItemId));
        }

        var content = await dbContext.FeedbackResponseContents
            .AsNoTracking()
            .Include(item => item.Answers)
            .SingleOrDefaultAsync(item => item.Id == mapping.ResponseContentId, cancellationToken);
        if (content is null)
        {
            return Result.Failure<FeedbackResponseItemDto>(
                Error.NotFound("FeedbackResponseContent", mapping.ResponseContentId));
        }

        var latestVersion = await dbContext.FeedbackResponseVersions
            .AsNoTracking()
            .Where(item => item.ResponseContentId == content.Id)
            .OrderByDescending(item => item.VersionNumber)
            .ThenByDescending(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return Result.Success(
            new FeedbackResponseItemDto(
                content.Id,
                content.Answers
                    .Select(answer => new FeedbackPromptAnswerDto(
                        answer.PromptSnapshotId,
                        answer.PromptText,
                        answer.PromptVersion,
                        answer.AnswerText,
                        answer.IsRequired))
                    .ToList(),
                latestVersion?.GeneralComment,
                content.SubmittedAt ?? latestVersion?.CreatedAt ?? DateTime.UtcNow));
    }
}
