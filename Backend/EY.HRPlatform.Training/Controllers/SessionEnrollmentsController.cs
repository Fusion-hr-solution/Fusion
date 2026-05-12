using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Enrollment.Commands;
using EY.HRPlatform.Training.Features.Enrollment.Queries;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/session-enrollments")]
[Authorize]
public class SessionEnrollmentsController : ControllerBase
{
    private readonly ISender _sender;
    private readonly int _cancellationDeadlineHours;

    public SessionEnrollmentsController(ISender sender, IConfiguration configuration)
    {
        _sender = sender;
        _cancellationDeadlineHours = configuration.GetValue("Enrollment:CancellationDeadlineHours", 24);
    }

    /// <summary>Get available sessions for enrollment in a training (part-by-part).</summary>
    [HttpGet("available/{trainingId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AvailableSessionsForEnrollmentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAvailableSessions(Guid trainingId, CancellationToken cancellationToken)
    {
        var employeeId = User.GetUserId();
        var result = await _sender.Send(
            new GetAvailableSessionsForEnrollmentQuery(employeeId, trainingId), cancellationToken);

        if (result.IsFailure)
            return NotFound(ApiResponse.Failure(result.Error.Message));

        return Ok(ApiResponse<AvailableSessionsForEnrollmentDto>.Success(result.Value));
    }

    /// <summary>Enroll in sessions for all parts of a training.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<EnrollInSessionsResultDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Enroll([FromBody] EnrollInSessionsRequest request, CancellationToken cancellationToken)
    {
        var employeeId = User.GetUserId();
        var selections = request.Selections
            .Select(s => new SessionSelectionItem(s.PartId, s.SessionId))
            .ToList();

        var result = await _sender.Send(
            new EnrollInSessionsCommand(employeeId, request.TrainingId, selections), cancellationToken);

        if (result.IsFailure)
        {
            if (result.Error.Code.Contains("NotFound"))
                return NotFound(ApiResponse.Failure(result.Error.Message));
            if (result.Error.Code.Contains("Conflict"))
                return Conflict(ApiResponse.Failure(result.Error.Message));
            return BadRequest(ApiResponse.Failure(result.Error.Message));
        }

        return CreatedAtAction(
            nameof(GetMyEnrollments),
            new { trainingId = request.TrainingId },
            ApiResponse<EnrollInSessionsResultDto>.Success(result.Value));
    }

    /// <summary>Get current employee's session enrollments for a training.</summary>
    [HttpGet("my/{trainingId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<MySessionEnrollmentsDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyEnrollments(Guid trainingId, CancellationToken cancellationToken)
    {
        var employeeId = User.GetUserId();
        var result = await _sender.Send(
            new GetMySessionEnrollmentsQuery(employeeId, trainingId), cancellationToken);

        if (result.IsFailure)
            return NotFound(ApiResponse.Failure(result.Error.Message));

        return Ok(ApiResponse<MySessionEnrollmentsDto>.Success(result.Value));
    }

    /// <summary>Cancel enrollment for a specific session.</summary>
    [HttpPost("cancel")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelEnrollment(
        [FromBody] CancelSessionEnrollmentRequest request, CancellationToken cancellationToken)
    {
        var employeeId = User.GetUserId();
        var result = await _sender.Send(
            new CancelSessionEnrollmentCommand(employeeId, request.SessionId, _cancellationDeadlineHours), cancellationToken);

        if (result.IsFailure)
        {
            if (result.Error.Code.Contains("NotFound"))
                return NotFound(ApiResponse.Failure(result.Error.Message));
            return BadRequest(ApiResponse.Failure(result.Error.Message));
        }

        return Ok(ApiResponse.Success());
    }

    /// <summary>Mark attendance for an employee in a session (admin only).</summary>
    [HttpPost("mark-attendance")]
    [Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkAttendance(
        [FromBody] MarkAttendanceRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new MarkAttendanceCommand(request.SessionId, request.EmployeeId), cancellationToken);

        if (result.IsFailure)
            return NotFound(ApiResponse.Failure(result.Error.Message));

        return Ok(ApiResponse.Success());
    }

    /// <summary>Get all session enrollments for the current employee across all trainings.</summary>
    [HttpGet("my")]
    [ProducesResponseType(typeof(ApiResponse<List<MyEnrollmentSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllMyEnrollments(CancellationToken cancellationToken)
    {
        var employeeId = User.GetUserId();
        var result = await _sender.Send(
            new GetAllMyEnrollmentsQuery(employeeId), cancellationToken);

        if (result.IsFailure)
            return BadRequest(ApiResponse.Failure(result.Error.Message));

        return Ok(ApiResponse<List<MyEnrollmentSummaryDto>>.Success(result.Value));
    }
}
