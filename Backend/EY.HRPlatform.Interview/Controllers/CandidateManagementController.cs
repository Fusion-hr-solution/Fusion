using EY.HRPlatform.Interview.Features.Candidates;
using EY.HRPlatform.Interview.Models.Candidates;
using EY.HRPlatform.Interview.Models.Common;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Interview.Controllers;

[ApiController]
[Route("api/interview/candidates/management")]
public class CandidateManagementController(
    ICandidateManagementService candidateManagementService,
    ICandidateRetentionService candidateRetentionService)
    : ControllerBase
{
    [HttpGet("overview")]
    [ProducesResponseType(typeof(ApiResponse<CandidateManagementOverviewDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOverview(CancellationToken cancellationToken)
    {
        var data = await candidateManagementService.GetOverviewAsync(cancellationToken);
        return Ok(ApiResponse<CandidateManagementOverviewDto>.Success(data));
    }

    [HttpGet("timeline/candidates")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CandidateTimelineCandidateDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTimelineCandidates([FromQuery] string testId, CancellationToken cancellationToken)
    {
        var data = await candidateManagementService.GetTimelineCandidatesAsync(testId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<CandidateTimelineCandidateDto>>.Success(data));
    }

    [HttpGet("timeline")]
    [ProducesResponseType(typeof(ApiResponse<CandidateProgressTimelineDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTimeline(
        [FromQuery] string testId,
        [FromQuery] string candidateEmail,
        CancellationToken cancellationToken)
    {
        var data = await candidateManagementService.GetTimelineAsync(testId, candidateEmail, cancellationToken);
        return Ok(ApiResponse<CandidateProgressTimelineDto>.Success(data));
    }

    [HttpGet("report")]
    [ProducesResponseType(typeof(ApiResponse<CandidateReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCandidateReport(
        [FromQuery] string testId,
        [FromQuery] string candidateEmail,
        [FromQuery] int? attemptNumber,
        CancellationToken cancellationToken)
    {
        var data = await candidateManagementService.GetCandidateReportAsync(
            testId,
            candidateEmail,
            attemptNumber,
            cancellationToken);
        return Ok(ApiResponse<CandidateReportDto>.Success(data));
    }

    [HttpPost("retake")]
    [ProducesResponseType(typeof(ApiResponse<CandidateRetakeGrantResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GrantRetake(
        [FromBody] GrantCandidateRetakeRequestDto request,
        CancellationToken cancellationToken)
    {
        var data = await candidateManagementService.GrantRetakeAsync(request, cancellationToken);
        return Ok(ApiResponse<CandidateRetakeGrantResultDto>.Success(data));
    }

    [HttpGet("attempt-settings")]
    [ProducesResponseType(typeof(ApiResponse<CandidateAttemptSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAttemptSettings(CancellationToken cancellationToken)
    {
        var data = await candidateManagementService.GetAttemptSettingsAsync(cancellationToken);
        return Ok(ApiResponse<CandidateAttemptSettingsDto>.Success(data));
    }

    [HttpPut("attempt-settings")]
    [ProducesResponseType(typeof(ApiResponse<CandidateAttemptSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SaveAttemptSettings(
        [FromBody] UpdateCandidateAttemptSettingsDto request,
        CancellationToken cancellationToken)
    {
        var data = await candidateManagementService.SaveAttemptSettingsAsync(request, cancellationToken);
        return Ok(ApiResponse<CandidateAttemptSettingsDto>.Success(data));
    }

    [HttpPost("privacy-actions")]
    [ProducesResponseType(typeof(ApiResponse<CandidatePrivacyActionResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ApplyPrivacyAction(
        [FromBody] CandidatePrivacyActionRequestDto request,
        CancellationToken cancellationToken)
    {
        var data = await candidateManagementService.ApplyPrivacyActionAsync(request, cancellationToken);
        return Ok(ApiResponse<CandidatePrivacyActionResultDto>.Success(data));
    }

    [HttpPost("privacy-actions/batch")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CandidatePrivacyActionResultDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ApplyPrivacyActionBatch(
        [FromBody] CandidatePrivacyActionBatchRequestDto request,
        CancellationToken cancellationToken)
    {
        var data = await candidateManagementService.ApplyPrivacyActionBatchAsync(request, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<CandidatePrivacyActionResultDto>>.Success(data));
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

    [HttpGet("retention")]
    [ProducesResponseType(typeof(ApiResponse<CandidateRetentionStateDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRetentionState(CancellationToken cancellationToken)
    {
        var data = await candidateRetentionService.GetStateAsync(cancellationToken);
        return Ok(ApiResponse<CandidateRetentionStateDto>.Success(data));
    }

    [HttpPut("retention")]
    [ProducesResponseType(typeof(ApiResponse<CandidateRetentionSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SaveRetentionSettings(
        [FromBody] UpdateCandidateRetentionSettingsDto request,
        CancellationToken cancellationToken)
    {
        var data = await candidateRetentionService.SaveSettingsAsync(request, cancellationToken);
        return Ok(ApiResponse<CandidateRetentionSettingsDto>.Success(data));
    }

    [HttpPost("retention/run")]
    [ProducesResponseType(typeof(ApiResponse<CandidateRetentionRunDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<CandidateRetentionRunDto>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<CandidateRetentionRunDto>), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RunRetention(
        [FromBody] RunCandidateRetentionRequestDto request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.TriggeredBy))
        {
            return BadRequest(ApiResponse<CandidateRetentionRunDto>.Failure(
                "TriggeredBy is required for audit logging."));
        }

        var data = await candidateRetentionService.RunRetentionSweepAsync(
            request.TriggeredBy,
            "Manual",
            cancellationToken);

        if (data is null)
        {
            return Conflict(ApiResponse<CandidateRetentionRunDto>.Failure(
                "A retention sweep is already in progress. Try again shortly."));
        }

        return Ok(ApiResponse<CandidateRetentionRunDto>.Success(data));
    }
}
