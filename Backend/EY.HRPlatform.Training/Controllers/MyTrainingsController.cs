using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.MyTrainings.Commands;
using EY.HRPlatform.Training.Features.MyTrainings.Queries;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/my-trainings")]
[Authorize]
public class MyTrainingsController : ControllerBase
{
    private readonly ISender _sender;

    public MyTrainingsController(ISender sender) => _sender = sender;

    /// <summary>Get all trainings enrolled by the current user.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<MyTrainingDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyTrainings(
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var employeeId = User.GetUserId();
        var result = await _sender.Send(new GetMyTrainingsQuery(employeeId, status), cancellationToken);
        return Ok(ApiResponse<List<MyTrainingDto>>.Success(result.Value!));
    }

    /// <summary>Get progress details for a specific enrolled training.</summary>
    [HttpGet("{trainingId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<MyTrainingDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTrainingProgress(Guid trainingId, CancellationToken cancellationToken)
    {
        var employeeId = User.GetUserId();
        var result = await _sender.Send(new GetMyTrainingProgressQuery(employeeId, trainingId), cancellationToken);

        if (result.IsFailure)
            return NotFound(ApiResponse.Failure(result.Error.Message));

        return Ok(ApiResponse<MyTrainingDto>.Success(result.Value!));
    }

    /// <summary>Self-enroll in a training.</summary>
    [HttpPost("enroll")]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Enroll([FromBody] EnrollRequest request, CancellationToken cancellationToken)
    {
        var employeeId = User.GetUserId();
        var result = await _sender.Send(new EnrollCommand(employeeId, request.TrainingId), cancellationToken);

        if (result.IsFailure)
        {
            return result.Error.Code.Contains("Conflict")
                ? Conflict(ApiResponse.Failure(result.Error.Message))
                : NotFound(ApiResponse.Failure(result.Error.Message));
        }

        return CreatedAtAction(
            nameof(GetTrainingProgress),
            new { trainingId = request.TrainingId },
            ApiResponse<Guid>.Success(result.Value));
    }

    /// <summary>Update progress for a specific chapter.</summary>
    [HttpPut("{trainingId:guid}/chapters/progress")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateChapterProgress(
        Guid trainingId,
        [FromBody] UpdateChapterProgressRequest request,
        CancellationToken cancellationToken)
    {
        var employeeId = User.GetUserId();
        var result = await _sender.Send(
            new UpdateChapterProgressCommand(employeeId, trainingId, request.ChapterId, request.Completed),
            cancellationToken);

        if (result.IsFailure)
            return NotFound(ApiResponse.Failure(result.Error.Message));

        return Ok(ApiResponse.Success());
    }
}
