using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Features.Calibration;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// A round's calibration session. Every action needs the calibrate grant; everything but
/// opening also needs the caller to be a named facilitator, which the handlers check.
/// Round administration alone confers nothing here.
/// </summary>
[ApiController]
[Authorize]
[Route("api/performance/review-rounds/{roundId:guid}/calibration")]
public sealed class CalibrationController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    private FacilitatorIdentity Actor => new(User.GetUserId(), User.GetEmployeeId(), User.GetFullName());

    [HttpGet("~/api/performance/cycles/{cycleId:guid}/calibration")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<CalibrationRoundDto>>>> Rounds(Guid cycleId, CancellationToken cancellationToken)
    {
        var hasGrant = policy.CanCalibrateReviews(User);
        if (!hasGrant) return CapabilityForbidden();
        return MapResult(await mediator.Send(new ListCalibrationRoundsQuery(cycleId, User.GetUserId(), hasGrant, User.GetEmployeeId()), cancellationToken));
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<CalibrationSessionDto>>> Get(Guid roundId, CancellationToken cancellationToken)
    {
        var hasGrant = policy.CanCalibrateReviews(User);
        if (!hasGrant) return CapabilityForbidden();
        return MapResult(await mediator.Send(new GetCalibrationSessionQuery(roundId, Actor, hasGrant), cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<CalibrationSessionDto>>> Open(Guid roundId, CancellationToken cancellationToken)
    {
        var hasGrant = policy.CanCalibrateReviews(User);
        if (!hasGrant) return CapabilityForbidden();
        return MapResult(await mediator.Send(new OpenCalibrationSessionCommand(roundId, Actor, hasGrant), cancellationToken));
    }

    [HttpGet("facilitator-candidates")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<FacilitatorCandidateDto>>>> Candidates(Guid roundId, CancellationToken cancellationToken)
    {
        var hasGrant = policy.CanCalibrateReviews(User);
        if (!hasGrant) return CapabilityForbidden();
        return MapResult(await mediator.Send(new ListFacilitatorCandidatesQuery(roundId, hasGrant), cancellationToken));
    }

    [HttpPut("facilitators")]
    public async Task<ActionResult<ApiResponse<CalibrationSessionDto>>> SetFacilitators(Guid roundId,
        [FromBody] SetCalibrationFacilitatorsRequest request, CancellationToken cancellationToken)
    {
        var hasGrant = policy.CanCalibrateReviews(User);
        if (!hasGrant) return CapabilityForbidden();
        return MapResult(await mediator.Send(new SetCalibrationFacilitatorsCommand(roundId, Actor, request.UserIds ?? [], request.ExpectedVersion, hasGrant),
            cancellationToken));
    }

    [HttpPut("subjects/{reviewId:guid}")]
    public async Task<ActionResult<ApiResponse<CalibrationSubjectDto>>> Adjust(Guid roundId, Guid reviewId,
        [FromBody] AdjustCalibrationSubjectRequest request, CancellationToken cancellationToken)
    {
        var hasGrant = policy.CanCalibrateReviews(User);
        if (!hasGrant) return CapabilityForbidden();
        return MapResult(await mediator.Send(new AdjustCalibrationSubjectCommand(roundId, reviewId, Actor, request.Rating, request.Rationale,
            request.DiscussionState, request.ExpectedVersion, hasGrant, request.Potential), cancellationToken));
    }

    [HttpGet("distribution")]
    public Task<ActionResult<ApiResponse<CalibrationDistributionViewDto>>> Distribution(Guid roundId, [FromQuery] CalibrationFilter filter,
        CancellationToken cancellationToken) => View<CalibrationDistributionViewDto>(roundId, filter, null, cancellationToken);

    [HttpGet("people")]
    public Task<ActionResult<ApiResponse<CalibrationPeopleViewDto>>> People(Guid roundId, [FromQuery] CalibrationFilter filter,
        CancellationToken cancellationToken) => View<CalibrationPeopleViewDto>(roundId, filter, null, cancellationToken);

    [HttpGet("nine-box")]
    public Task<ActionResult<ApiResponse<CalibrationNineBoxViewDto>>> NineBox(Guid roundId, [FromQuery] CalibrationFilter filter,
        CancellationToken cancellationToken) => View<CalibrationNineBoxViewDto>(roundId, filter, null, cancellationToken);

    [HttpGet("subjects/{reviewId:guid}")]
    public Task<ActionResult<ApiResponse<CalibrationSubjectDetailDto>>> Subject(Guid roundId, Guid reviewId, CancellationToken cancellationToken)
        => View<CalibrationSubjectDetailDto>(roundId, new CalibrationFilter(), reviewId, cancellationToken);

    [HttpGet("finalize-preview")]
    public Task<ActionResult<ApiResponse<CalibrationFinalizePreviewDto>>> FinalizePreview(Guid roundId, CancellationToken cancellationToken)
        => View<CalibrationFinalizePreviewDto>(roundId, new CalibrationFilter(), null, cancellationToken);

    [HttpGet("changes")]
    public Task<ActionResult<ApiResponse<CalibrationChangesViewDto>>> Changes(Guid roundId, [FromQuery] CalibrationFilter filter,
        CancellationToken cancellationToken) => View<CalibrationChangesViewDto>(roundId, filter, null, cancellationToken);

    private async Task<ActionResult<ApiResponse<T>>> View<T>(Guid roundId, CalibrationFilter filter, Guid? reviewId, CancellationToken cancellationToken)
    {
        var hasGrant = policy.CanCalibrateReviews(User);
        if (!hasGrant) return CapabilityForbidden();
        return MapResult(await mediator.Send(new GetCalibrationViewQuery<T>(roundId, Actor, filter, hasGrant, reviewId), cancellationToken));
    }

    [HttpPost("finalize")]
    public async Task<ActionResult<ApiResponse<CalibrationSessionDto>>> Finalize(Guid roundId,
        [FromBody] ExpectedVersionRequest request, CancellationToken cancellationToken)
    {
        var hasGrant = policy.CanCalibrateReviews(User);
        if (!hasGrant) return CapabilityForbidden();
        return MapResult(await mediator.Send(new FinalizeCalibrationSessionCommand(roundId, Actor, request.ExpectedVersion, hasGrant), cancellationToken));
    }
}
