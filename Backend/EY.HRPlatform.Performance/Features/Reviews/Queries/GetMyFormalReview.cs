using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Reviews.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Reviews.Queries;

public sealed record GetMyFormalReviewQuery(Guid WorkItemId) : IQuery<Result<FormalReviewWorkItemDto>>;

public sealed class GetMyFormalReviewQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : IQueryHandler<GetMyFormalReviewQuery, Result<FormalReviewWorkItemDto>>
{
    public async Task<Result<FormalReviewWorkItemDto>> Handle(GetMyFormalReviewQuery request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure<FormalReviewWorkItemDto>(Error.Forbidden("Review.EmployeeContextRequired", "An employee context is required to view a review."));
        var workItem = await dbContext.CampaignWorkItems.AsNoTracking().SingleOrDefaultAsync(item => item.Id == request.WorkItemId, cancellationToken);
        if (workItem is null) return Result.Failure<FormalReviewWorkItemDto>(Error.NotFound("CampaignWorkItem", request.WorkItemId));
        if (workItem.AssigneeEmployeeId != currentUser.EmployeeId.Value || workItem.Type is not (CampaignWorkItemType.SelfReview or CampaignWorkItemType.ManagerReview))
            return Result.Failure<FormalReviewWorkItemDto>(Error.Forbidden("Review.NotAssigned", "The current employee is not assigned this formal review."));

        var kind = workItem.Type == CampaignWorkItemType.SelfReview ? FormalReviewKind.Self : FormalReviewKind.Manager;
        var definition = await dbContext.FormalReviewDefinitionSnapshots.AsNoTracking()
            .Include(item => item.Criteria).Include(item => item.RatingScaleLevels)
            .SingleOrDefaultAsync(item => item.CycleId == workItem.CycleId && item.Kind == kind, cancellationToken);
        if (definition is null)
            return Result.Failure<FormalReviewWorkItemDto>(Error.Conflict("Review.DefinitionMissing", "The campaign has no frozen definition for this review."));

        var review = await dbContext.PerformanceReviews.AsNoTracking()
            .Include(item => item.Criteria)
            .SingleOrDefaultAsync(item => item.WorkItemId == workItem.Id, cancellationToken);
        return new FormalReviewWorkItemDto(
            workItem.Id, workItem.CycleId, workItem.SubjectEmployeeId, kind.ToString(), workItem.Status.ToString(), definition.Id,
            definition.Name, definition.RatingScaleName,
            definition.Criteria.OrderBy(item => item.DisplayOrder).Select(item => new FormalReviewCriterionDto(item.Id, item.Name, item.Description, item.DisplayOrder)).ToList(),
            definition.RatingScaleLevels.OrderBy(item => item.Value).Select(item => new FormalRatingScaleLevelDto(item.Value, item.Label, item.Description)).ToList(),
            review?.Id, review?.Status.ToString(), review?.Narrative, review?.EvidenceReference,
            review?.Criteria.Select(item => new FormalReviewResponseCriterionDto(item.CriterionSnapshotId, item.Rating, item.Comment)).ToList() ?? [],
            review?.IsLocked ?? false, review?.FinalizedAt, review?.CorrectionWorkItemId);
    }
}
