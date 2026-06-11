using EY.HRPlatform.Interview.Features.Candidates;
using EY.HRPlatform.Interview.Models.Candidates;
using EY.HRPlatform.Interview.Models.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Interview.Controllers;

[ApiController]
[Route("api/interview/candidates/invitations")]
public class CandidateInvitationsController(ICandidateInvitationService invitationService) : ControllerBase
{
    [HttpGet("pending")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CandidateInvitationDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPending([FromQuery] string? testId, CancellationToken cancellationToken)
    {
        var data = await invitationService.GetPendingAsync(testId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<CandidateInvitationDto>>.Success(data));
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<CandidateInvitationDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateCandidateInvitationDto request, CancellationToken cancellationToken)
    {
        var data = await invitationService.CreateAsync(request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, ApiResponse<CandidateInvitationDto>.Success(data));
    }

    [HttpPost("bulk")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CandidateInvitationDto>>), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateBulk([FromBody] CreateBulkCandidateInvitationsDto request, CancellationToken cancellationToken)
    {
        var data = await invitationService.CreateBulkAsync(request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, ApiResponse<IReadOnlyList<CandidateInvitationDto>>.Success(data));
    }

    [HttpPost("{id}/resend")]
    [ProducesResponseType(typeof(ApiResponse<CandidateInvitationDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Resend(string id, CancellationToken cancellationToken)
    {
        var data = await invitationService.ResendAsync(id, cancellationToken);
        return Ok(ApiResponse<CandidateInvitationDto>.Success(data));
    }

    // Destructive operation — require an authenticated admin so invitations can't be
    // deleted anonymously by anyone who can reach the service.
    [Authorize]
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        await invitationService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
