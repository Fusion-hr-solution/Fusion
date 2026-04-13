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
}
