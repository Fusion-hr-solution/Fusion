using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Reviews.Commands;

public sealed record FormalReviewCriterionDefinitionInput(string Name, string? Description, int DisplayOrder);
public sealed record FormalRatingScaleLevelDefinitionInput(int Value, string Label, string? Description);

public sealed record ConfigureFormalReviewDefinitionCommand(
    Guid CycleId,
    FormalReviewKind Kind,
    string Name,
    IReadOnlyList<FormalReviewCriterionDefinitionInput> Criteria,
    string RatingScaleName,
    IReadOnlyList<FormalRatingScaleLevelDefinitionInput> RatingScaleLevels) : ICommand<Result<Guid>>;

/// <summary>
/// Campaign review definitions are configured only while draft. Replacing a draft definition
/// creates a fresh snapshot; once preparation starts, it is immutable campaign evidence.
/// </summary>
public sealed class ConfigureFormalReviewDefinitionCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser)
    : ICommandHandler<ConfigureFormalReviewDefinitionCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(ConfigureFormalReviewDefinitionCommand request, CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles.SingleOrDefaultAsync(item => item.Id == request.CycleId, cancellationToken);
        if (cycle is null) return Result.Failure<Guid>(Error.NotFound("PerformanceCycle", request.CycleId));
        if (!cycle.IsEditable)
            return Result.Failure<Guid>(Error.Conflict("Review.DefinitionFrozen", "Review definitions cannot change after campaign preparation starts."));

        try
        {
            var existing = await dbContext.FormalReviewDefinitionSnapshots
                .SingleOrDefaultAsync(item => item.CycleId == cycle.Id && item.Kind == request.Kind, cancellationToken);
            if (existing is not null) dbContext.FormalReviewDefinitionSnapshots.Remove(existing);

            var definition = FormalReviewDefinitionSnapshot.Create(cycle.TenantId, cycle.Id, request.Kind, request.Name,
                request.Criteria.Select(item => new ReviewCriterionDefinition(item.Name, item.Description, item.DisplayOrder)),
                request.RatingScaleName,
                request.RatingScaleLevels.Select(item => new RatingScaleLevelDefinition(item.Value, item.Label, item.Description)),
                DateTime.UtcNow);
            dbContext.FormalReviewDefinitionSnapshots.Add(definition);
            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                cycle.TenantId, cycle.Id, PerformanceCycleAuditAction.ReviewDefinitionConfigured,
                currentUser.UserId, currentUser.FullName, $"{request.Kind} review definition configured."));
            await dbContext.SaveChangesAsync(cancellationToken);
            return definition.Id;
        }
        catch (ArgumentException exception)
        {
            return Result.Failure<Guid>(Error.Validation("Review.InvalidDefinition", exception.Message));
        }
    }
}

public sealed record FormalReviewCriterionResponseInput(Guid CriterionSnapshotId, int Rating, string? Comment);

public sealed record SubmitFormalReviewCommand(
    Guid WorkItemId,
    IReadOnlyList<FormalReviewCriterionResponseInput> Criteria,
    string? Narrative,
    string? EvidenceReference) : ICommand<Result<Guid>>;

public sealed class SubmitFormalReviewCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : ICommandHandler<SubmitFormalReviewCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(SubmitFormalReviewCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure<Guid>(Error.Forbidden("Review.EmployeeContextRequired", "An employee context is required to submit a review."));

        var workItem = await dbContext.CampaignWorkItems.SingleOrDefaultAsync(item => item.Id == request.WorkItemId, cancellationToken);
        if (workItem is null) return Result.Failure<Guid>(Error.NotFound("CampaignWorkItem", request.WorkItemId));
        if (workItem.AssigneeEmployeeId != currentUser.EmployeeId.Value ||
            workItem.Type is not (CampaignWorkItemType.SelfReview or CampaignWorkItemType.ManagerReview))
            return Result.Failure<Guid>(Error.Forbidden("Review.NotAssigned", "The current employee is not assigned this formal review."));
        if (workItem.Status is not (CampaignWorkItemStatus.Assigned or CampaignWorkItemStatus.InProgress))
            return Result.Failure<Guid>(Error.Conflict("Review.InvalidWorkItemState", "This formal review is no longer open for submission."));
        if (await dbContext.PerformanceReviews.AnyAsync(item => item.WorkItemId == workItem.Id, cancellationToken))
            return Result.Failure<Guid>(Error.Conflict("Review.AlreadySubmitted", "This formal review already has a response."));

        var kind = workItem.Type == CampaignWorkItemType.SelfReview ? FormalReviewKind.Self : FormalReviewKind.Manager;
        var definition = await dbContext.FormalReviewDefinitionSnapshots
            .Include(item => item.Criteria)
            .Include(item => item.RatingScaleLevels)
            .SingleOrDefaultAsync(item => item.CycleId == workItem.CycleId && item.Kind == kind, cancellationToken);
        if (definition is null)
            return Result.Failure<Guid>(Error.Conflict("Review.DefinitionMissing", "The campaign has no frozen definition for this review."));

        if (!MatchesFrozenDefinition(request.Criteria, definition))
            return Result.Failure<Guid>(Error.Validation("Review.InvalidResponses", "Responses must cover every frozen criterion using an approved rating."));

        try
        {
            var review = PerformanceReview.Create(workItem.TenantId, workItem.CycleId, workItem.Id,
                workItem.SubjectEmployeeId, currentUser.EmployeeId.Value, kind, definition.Id);
            review.Submit(request.Criteria.Select(item => new ReviewCriterionResponse(item.CriterionSnapshotId, item.Rating, item.Comment)),
                request.Narrative, request.EvidenceReference, DateTime.UtcNow);
            workItem.Submit(DateTime.UtcNow);
            dbContext.PerformanceReviews.Add(review);
            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                workItem.TenantId, workItem.CycleId, PerformanceCycleAuditAction.ReviewSubmitted,
                currentUser.UserId, currentUser.FullName, $"{kind} review submitted."));
            await dbContext.SaveChangesAsync(cancellationToken);
            return review.Id;
        }
        catch (DomainRuleViolationException exception)
        {
            return Result.Failure<Guid>(Error.Conflict("Review.InvalidTransition", exception.Message));
        }
    }

    private static bool MatchesFrozenDefinition(
        IReadOnlyList<FormalReviewCriterionResponseInput> responses,
        FormalReviewDefinitionSnapshot definition)
    {
        if (responses.Count != definition.Criteria.Count || responses.Select(item => item.CriterionSnapshotId).Distinct().Count() != responses.Count)
            return false;
        var criterionIds = definition.Criteria.Select(item => item.Id).ToHashSet();
        var allowedRatings = definition.RatingScaleLevels.Select(item => item.Value).ToHashSet();
        return responses.All(item => criterionIds.Contains(item.CriterionSnapshotId) && allowedRatings.Contains(item.Rating));
    }
}

public sealed record FinalizeManagerReviewCommand(Guid ReviewId) : ICommand<Result>;

public sealed class FinalizeManagerReviewCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : ICommandHandler<FinalizeManagerReviewCommand, Result>
{
    public async Task<Result> Handle(FinalizeManagerReviewCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure(Error.Forbidden("Review.EmployeeContextRequired", "An employee context is required to finalize a review."));
        var review = await dbContext.PerformanceReviews.SingleOrDefaultAsync(item => item.Id == request.ReviewId, cancellationToken);
        if (review is null) return Result.Failure(Error.NotFound("PerformanceReview", request.ReviewId));
        if (review.Kind != FormalReviewKind.Manager || review.ReviewerEmployeeId != currentUser.EmployeeId.Value)
            return Result.Failure(Error.Forbidden("Review.FinalizationNotAssigned", "Only the accountable manager reviewer can finalize this outcome."));

        var workItem = await dbContext.CampaignWorkItems.SingleOrDefaultAsync(item => item.Id == review.WorkItemId, cancellationToken);
        if (workItem is null || workItem.Status != CampaignWorkItemStatus.Submitted)
            return Result.Failure(Error.Conflict("Review.ManagerAssessmentNotSubmitted", "The manager assessment must be submitted before finalization."));

        try
        {
            review.FinalizeOutcome(DateTime.UtcNow);
            workItem.Complete(DateTime.UtcNow);
            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                review.TenantId, review.CycleId, PerformanceCycleAuditAction.ManagerReviewFinalized,
                currentUser.UserId, currentUser.FullName, "Manager assessment finalized."));
            await dbContext.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (DomainRuleViolationException exception)
        {
            return Result.Failure(Error.Conflict("Review.InvalidFinalization", exception.Message));
        }
    }
}

public sealed record RequestFormalReviewCorrectionCommand(Guid ReviewId, string Reason, DateTime DueAt) : ICommand<Result<Guid>>;

public sealed class RequestFormalReviewCorrectionCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : ICommandHandler<RequestFormalReviewCorrectionCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(RequestFormalReviewCorrectionCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure<Guid>(Error.Forbidden("Review.EmployeeContextRequired", "An employee context is required to request a correction."));
        var review = await dbContext.PerformanceReviews.SingleOrDefaultAsync(item => item.Id == request.ReviewId, cancellationToken);
        if (review is null) return Result.Failure<Guid>(Error.NotFound("PerformanceReview", request.ReviewId));
        if (review.Kind != FormalReviewKind.Manager || review.ReviewerEmployeeId != currentUser.EmployeeId.Value)
            return Result.Failure<Guid>(Error.Forbidden("Review.CorrectionNotAssigned", "Only the accountable manager reviewer can request this correction."));

        try
        {
            var workItem = review.RequestCorrection(DateTime.UtcNow, request.Reason, request.DueAt);
            dbContext.CampaignWorkItems.Add(workItem);
            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                review.TenantId, review.CycleId, PerformanceCycleAuditAction.ReviewCorrectionRequested,
                currentUser.UserId, currentUser.FullName, "Controlled manager-review correction requested."));
            await dbContext.SaveChangesAsync(cancellationToken);
            return workItem.Id;
        }
        catch (DomainRuleViolationException exception)
        {
            return Result.Failure<Guid>(Error.Conflict("Review.InvalidCorrection", exception.Message));
        }
        catch (ArgumentException exception)
        {
            return Result.Failure<Guid>(Error.Validation("Review.InvalidCorrection", exception.Message));
        }
    }
}
