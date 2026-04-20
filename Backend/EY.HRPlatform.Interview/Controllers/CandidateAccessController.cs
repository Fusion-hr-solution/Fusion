using EY.HRPlatform.Interview.Features.Candidates;
using EY.HRPlatform.Interview.Models.Candidates;
using EY.HRPlatform.Interview.Models.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using System.Linq;

namespace EY.HRPlatform.Interview.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/interview/candidate-access")]
public class CandidateAccessController(ICandidateAccessService candidateAccessService) : ControllerBase
{
    [HttpGet("validate")]
    [ProducesResponseType(typeof(ApiResponse<CandidateAccessValidationDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Validate([FromQuery] string token, CancellationToken cancellationToken)
    {
        var data = await candidateAccessService.ValidateAsync(token, cancellationToken);
        return Ok(ApiResponse<CandidateAccessValidationDto>.Success(data));
    }

    [HttpPost("start")]
    [ProducesResponseType(typeof(ApiResponse<CandidateAccessSessionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Start([FromBody] StartCandidateAttemptDto request, CancellationToken cancellationToken)
    {
        request.ClientIpAddress = ResolveClientIpAddress();
        request.UserAgent = Request.Headers.UserAgent.ToString();

        var data = await candidateAccessService.StartOrResumeAsync(request, cancellationToken);
        return Ok(ApiResponse<CandidateAccessSessionDto>.Success(data));
    }

    [HttpPost("submit")]
    [ProducesResponseType(typeof(ApiResponse<CandidateAccessSubmissionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Submit([FromBody] SubmitCandidateAttemptDto request, CancellationToken cancellationToken)
    {
        request.ClientIpAddress = ResolveClientIpAddress();
        request.UserAgent = Request.Headers.UserAgent.ToString();

        var data = await candidateAccessService.SubmitAsync(request, cancellationToken);
        return Ok(ApiResponse<CandidateAccessSubmissionDto>.Success(data));
    }

    private string? ResolveClientIpAddress()
    {
        if (Request.Headers.TryGetValue("X-Forwarded-For", out StringValues forwardedFor))
        {
            var raw = forwardedFor.ToString();
            if (!string.IsNullOrWhiteSpace(raw))
            {
                var first = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(first))
                {
                    return first;
                }
            }
        }

        return HttpContext.Connection.RemoteIpAddress?.ToString();
    }
}
