using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Admin.Quiz;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

/// <summary>
/// US-8.2.5 — AI quiz generation for a training. Generate into a draft and read it back; the
/// review/edit + publish endpoints follow in the next slice. Admin-only.
/// </summary>
[ApiController]
[Route("api/training/admin/trainings/{trainingId:guid}/quiz")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminQuizController : ControllerBase
{
    private const int DefaultCount = 10;

    private readonly ISender _sender;

    public AdminQuizController(ISender sender) => _sender = sender;

    /// <summary>Generate quiz questions from the training's content into its draft.</summary>
    [HttpPost("generate")]
    [ProducesResponseType(typeof(ApiResponse<QuizDraftDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Generate(
        Guid trainingId, [FromQuery] int? count, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new GenerateQuizCommand(trainingId, count ?? DefaultCount, User.GetUserId()), cancellationToken);

        if (result.IsFailure)
        {
            if (result.Error.Code == "Quiz.LlmUnavailable")
                return StatusCode(StatusCodes.Status503ServiceUnavailable, ApiResponse.Failure(result.Error.Message));
            if (result.Error.Code.EndsWith(".NotFound", StringComparison.Ordinal))
                return NotFound(ApiResponse.Failure(result.Error.Message));
            return BadRequest(ApiResponse.Failure(result.Error.Message));
        }

        return Ok(ApiResponse<QuizDraftDto>.Success(result.Value!));
    }

    /// <summary>Read the training's current quiz draft (and whether AI generation is available).</summary>
    [HttpGet("draft")]
    [ProducesResponseType(typeof(ApiResponse<QuizDraftDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDraft(Guid trainingId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetQuizDraftQuery(trainingId), cancellationToken);
        return Ok(ApiResponse<QuizDraftDto>.Success(result.Value!));
    }
}
