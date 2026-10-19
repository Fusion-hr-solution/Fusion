using EY.HRPlatform.Performance.Features.Conversations;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// Feedback between colleagues and requests for it (D-13). Anyone in Performance with an employee record gives and asks;
/// what each person reads is decided by <c>FeedbackPolicy</c> in the handlers. There is no edit or delete: feedback is
/// fixed once sent.
/// </summary>
[ApiController]
[Authorize]
[Route("api/performance/feedback")]
public sealed class FeedbackController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    private FeedbackActor Actor => new(
        User.GetEmployeeId() ?? Guid.Empty,
        policy.CanAdministerCycles(User),
        policy.CanReviewDirectReports(User),
        policy.CanManageOrganizationalObjectives(User),
        policy.CanPublishStrategy(User));

    private bool Entered => policy.CanEnterPerformance(User);
    private bool AsPerson => Entered && User.GetEmployeeId() is Guid id && id != Guid.Empty;

    [HttpGet]
    public async Task<ActionResult<ApiResponse<FeedbackPageDto>>> List([FromQuery] FeedbackView view = FeedbackView.Received,
        [FromQuery] Guid? cycleId = null, [FromQuery] Guid? objectiveId = null, [FromQuery] string? before = null, [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
        => Entered ? MapResult(await mediator.Send(new ListFeedbackQuery(view, cycleId, objectiveId, before, limit, Actor), cancellationToken))
            : CapabilityForbidden();

    /// <summary>The caller's feedback at a glance: received, given, waiting on them, and objectives to ask about.</summary>
    [HttpGet("summary")]
    public async Task<ActionResult<ApiResponse<FeedbackSummaryDto>>> Summary(CancellationToken cancellationToken)
        => Entered ? MapResult(await mediator.Send(new GetFeedbackSummaryQuery(Actor), cancellationToken)) : CapabilityForbidden();

    [HttpPost]
    public async Task<ActionResult<ApiResponse<FeedbackDto>>> Give([FromBody] GiveFeedbackRequest request, CancellationToken cancellationToken)
        => AsPerson ? MapResult(await mediator.Send(new GiveFeedbackCommand(request, Actor), cancellationToken)) : CapabilityForbidden();

    [HttpGet("{feedbackId:guid}")]
    public async Task<ActionResult<ApiResponse<FeedbackDto>>> Get(Guid feedbackId, CancellationToken cancellationToken)
        => Entered ? MapResult(await mediator.Send(new GetFeedbackQuery(feedbackId, Actor), cancellationToken)) : CapabilityForbidden();

    [HttpGet("requests")]
    public async Task<ActionResult<ApiResponse<FeedbackRequestsDto>>> Requests(CancellationToken cancellationToken)
        => Entered ? MapResult(await mediator.Send(new ListFeedbackRequestsQuery(Actor), cancellationToken)) : CapabilityForbidden();

    [HttpPost("requests")]
    public async Task<ActionResult<ApiResponse<FeedbackRequestDto>>> Ask([FromBody] AskForFeedbackRequest request, CancellationToken cancellationToken)
        => AsPerson ? MapResult(await mediator.Send(new AskForFeedbackCommand(request, Actor), cancellationToken)) : CapabilityForbidden();

    [HttpGet("requests/{requestId:guid}")]
    public async Task<ActionResult<ApiResponse<FeedbackRequestDto>>> Request(Guid requestId, CancellationToken cancellationToken)
        => Entered ? MapResult(await mediator.Send(new GetFeedbackRequestQuery(requestId, Actor), cancellationToken)) : CapabilityForbidden();

    [HttpPost("requests/{requestId:guid}/answer")]
    public async Task<ActionResult<ApiResponse<FeedbackRequestDto>>> Answer(Guid requestId, [FromBody] AnswerFeedbackRequest request,
        CancellationToken cancellationToken)
        => AsPerson ? MapResult(await mediator.Send(new AnswerFeedbackRequestCommand(requestId, request, Actor), cancellationToken)) : CapabilityForbidden();

    [HttpPost("requests/{requestId:guid}/decline")]
    public async Task<ActionResult<ApiResponse<FeedbackRequestDto>>> Decline(Guid requestId, [FromBody] DeclineFeedbackRequest request,
        CancellationToken cancellationToken)
        => AsPerson ? MapResult(await mediator.Send(new DeclineFeedbackRequestCommand(requestId, request, Actor), cancellationToken)) : CapabilityForbidden();

    [HttpPost("requests/{requestId:guid}/close")]
    public async Task<ActionResult<ApiResponse<FeedbackRequestDto>>> Close(Guid requestId, CancellationToken cancellationToken)
        => AsPerson ? MapResult(await mediator.Send(new CloseFeedbackRequestCommand(requestId, Actor), cancellationToken)) : CapabilityForbidden();
}
