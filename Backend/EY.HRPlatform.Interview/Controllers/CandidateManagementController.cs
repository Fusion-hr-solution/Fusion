using EY.HRPlatform.Interview.Features.Candidates;
using EY.HRPlatform.Interview.Models.Candidates;
using EY.HRPlatform.Interview.Models.Common;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Interview.Controllers;

[ApiController]
[Route("api/interview/candidates/management")]
public class CandidateManagementController(ICandidateManagementService candidateManagementService) : ControllerBase
{
    [HttpGet("overview")]
    [ProducesResponseType(typeof(ApiResponse<CandidateManagementOverviewDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOverview(CancellationToken cancellationToken)
    {
        var data = await candidateManagementService.GetOverviewAsync(cancellationToken);
        return Ok(ApiResponse<CandidateManagementOverviewDto>.Success(data));
    }

    [HttpGet("link-security")]
    [ProducesResponseType(typeof(ApiResponse<CandidateLinkSecurityStateDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLinkSecurity([FromQuery] string testId, CancellationToken cancellationToken)
    {
        var data = await candidateManagementService.GetLinkSecurityAsync(testId, cancellationToken);
        return Ok(ApiResponse<CandidateLinkSecurityStateDto>.Success(data));
    }

    [HttpPut("link-security")]
    [ProducesResponseType(typeof(ApiResponse<CandidateLinkSecurityStateDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SaveLinkSecurity(
        [FromBody] UpdateCandidateLinkSecuritySettingsDto request,
        CancellationToken cancellationToken)
    {
        var data = await candidateManagementService.SaveLinkSecurityAsync(request, cancellationToken);
        return Ok(ApiResponse<CandidateLinkSecurityStateDto>.Success(data));
    }

    [HttpPost("link-security/{testId}/regenerate")]
    [ProducesResponseType(typeof(ApiResponse<CandidateLinkSecurityStateDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> RegenerateLink(string testId, CancellationToken cancellationToken)
    {
        var data = await candidateManagementService.RegenerateLinkAsync(testId, cancellationToken);
        return Ok(ApiResponse<CandidateLinkSecurityStateDto>.Success(data));
    }
}
