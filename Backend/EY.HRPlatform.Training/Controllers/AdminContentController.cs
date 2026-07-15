using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Admin.Content;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

/// <summary>US-8.2.5 — admin content maintenance utilities.</summary>
[ApiController]
[Route("api/training/admin/content")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminContentController : ControllerBase
{
    private readonly ISender _sender;

    public AdminContentController(ISender sender) => _sender = sender;

    /// <summary>
    /// One-time, idempotent: extract and store text for existing uploaded PDFs that have none yet, so
    /// they feed the AI quiz generator. Safe to re-run. Returns scanned / updated / skipped counts.
    /// </summary>
    [HttpPost("backfill-pdf-text")]
    [ProducesResponseType(typeof(ApiResponse<BackfillPdfTextResult>), StatusCodes.Status200OK)]
    public async Task<IActionResult> BackfillPdfText(CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new BackfillPdfTextCommand(), cancellationToken);
        return Ok(ApiResponse<BackfillPdfTextResult>.Success(result.Value!));
    }
}
