using EY.HRPlatform.Performance.Features.Reviews;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Authorize]
[Route("api/performance/reviews")]
public sealed class PerformanceReviewsController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    [HttpGet("history")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<ReviewHistoryItemDto>>>> History(Guid? cycleId, CancellationToken token)
    {
        if (!policy.CanEnterPerformance(User) && !policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new GetReviewHistoryQuery(cycleId, User.GetEmployeeId() ?? Guid.Empty,
            policy.CanAdministerCycles(User), policy.CanReviewDirectReports(User)), token));
    }

    [HttpGet("{reviewId:guid}")]
    public async Task<ActionResult<ApiResponse<PerformanceReviewDto>>> Get(Guid reviewId, CancellationToken token)
    {
        var calibrates = policy.CanCalibrateReviews(User);
        if (!policy.CanEnterPerformance(User) && !policy.CanAdministerCycles(User) && !calibrates) return CapabilityForbidden();
        return MapResult(await mediator.Send(new GetPerformanceReviewQuery(reviewId,
            new ReviewActor(User.GetEmployeeId() ?? Guid.Empty, policy.CanAdministerCycles(User),
                CalibratorUserId: calibrates ? User.GetUserId() : null,
                CanParticipate: policy.CanManageOwnParticipation(User),
                CanReviewReports: policy.CanReviewDirectReports(User))), token));
    }

    [HttpPut("{reviewId:guid}/self-assessment")]
    public async Task<ActionResult<ApiResponse<PerformanceReviewMutationDto>>> SaveSelf(Guid reviewId,
        [FromBody] SaveSelfAssessmentRequest request, CancellationToken token)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new SaveSelfAssessmentCommand(reviewId, AssessmentActor(),
            request.ExpectedVersion, request.Summary, request.Items), token));
    }

    [HttpPost("{reviewId:guid}/self-assessment")]
    public async Task<ActionResult<ApiResponse<PerformanceReviewMutationDto>>> SubmitSelf(Guid reviewId,
        [FromBody] SaveSelfAssessmentRequest request, CancellationToken token)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new SubmitSelfAssessmentCommand(reviewId, AssessmentActor(),
            request.ExpectedVersion, request.Summary, request.Items), token));
    }

    [HttpPut("{reviewId:guid}/manager-assessment")]
    public async Task<ActionResult<ApiResponse<PerformanceReviewMutationDto>>> SaveManager(Guid reviewId,
        [FromBody] SaveManagerAssessmentRequest request, CancellationToken token)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new SaveManagerAssessmentCommand(reviewId, AssessmentActor(),
            request.ExpectedVersion, request.Summary, request.OverallRating, request.Items), token));
    }

    [HttpPost("{reviewId:guid}/manager-assessment")]
    public async Task<ActionResult<ApiResponse<PerformanceReviewMutationDto>>> SubmitManager(Guid reviewId,
        [FromBody] SaveManagerAssessmentRequest request, CancellationToken token)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new SubmitManagerAssessmentCommand(reviewId, AssessmentActor(),
            request.ExpectedVersion, request.Summary, request.OverallRating, request.Items), token));
    }

    [HttpPost("{reviewId:guid}/finalize")]
    public async Task<ActionResult<ApiResponse<ReviewFinalizationDto>>> Finalize(Guid reviewId, [FromBody] FinalizeReviewRequest request, CancellationToken token)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new FinalizeReviewCommand(reviewId, request.ExpectedVersion, User.GetEmployeeId() ?? Guid.Empty), token));
    }

    [HttpPost("{reviewId:guid}/close")]
    public async Task<ActionResult<ApiResponse<PerformanceReviewMutationDto>>> Close(Guid reviewId,
        [FromBody] CloseReviewRequest request, CancellationToken token)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new CloseReviewCommand(reviewId, request.ExpectedVersion, request.Reason), token));
    }

    private ReviewActor AssessmentActor()
        => new(User.GetEmployeeId() ?? Guid.Empty, policy.CanAdministerCycles(User),
            CanParticipate: policy.CanManageOwnParticipation(User),
            CanReviewReports: policy.CanReviewDirectReports(User));
}
