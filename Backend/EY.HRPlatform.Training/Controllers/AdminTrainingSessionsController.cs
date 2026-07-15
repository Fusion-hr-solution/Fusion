using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Admin.Sessions;
using EY.HRPlatform.Training.Features.Admin.Sessions.Commands;
using EY.HRPlatform.Training.Features.Admin.Sessions.Export;
using EY.HRPlatform.Training.Features.Admin.Sessions.Queries;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/admin")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminTrainingSessionsController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminTrainingSessionsController> _logger;
    private readonly ISessionParticipantExporter _exporter;

    public AdminTrainingSessionsController(
        ISender sender,
        ILogger<AdminTrainingSessionsController> logger,
        ISessionParticipantExporter exporter)
    {
        _sender = sender;
        _logger = logger;
        _exporter = exporter;
    }

    /// <summary>Global session list with filters: trainingId, date range, status, trainer, search.</summary>
    [HttpGet("sessions")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponse<TrainingSessionListItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSessions(
        [FromQuery] Guid? trainingId,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] string? status,
        [FromQuery] Guid? trainerEmployeeId,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _sender.Send(
                new GetSessionsQuery(trainingId, fromUtc, toUtc, status, trainerEmployeeId, search, page, pageSize),
                cancellationToken);

            return Ok(ApiResponse<PagedResponse<TrainingSessionListItemDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve sessions");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving sessions."));
        }
    }

    /// <summary>Detailed view of a single session.</summary>
    [HttpGet("sessions/{sessionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<TrainingSessionDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSessionDetail(Guid sessionId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetSessionDetailQuery(sessionId), cancellationToken);
            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));
            return Ok(ApiResponse<TrainingSessionDetailDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve session {SessionId}", sessionId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the session."));
        }
    }

    /// <summary>Export the participant list for a session as Excel (.xlsx).</summary>
    [HttpGet("sessions/{sessionId:guid}/export/excel")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ExportParticipantsExcel(Guid sessionId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetSessionParticipantsForExportQuery(sessionId), cancellationToken);
            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            var bytes = _exporter.ToExcel(result.Value!);
            var fileName = BuildExportFileName(result.Value!, "xlsx");
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export participants (Excel) for session {SessionId}", sessionId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while exporting the participant list."));
        }
    }

    /// <summary>Export the participant list for a session as PDF.</summary>
    [HttpGet("sessions/{sessionId:guid}/export/pdf")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ExportParticipantsPdf(Guid sessionId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetSessionParticipantsForExportQuery(sessionId), cancellationToken);
            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            var bytes = _exporter.ToPdf(result.Value!);
            var fileName = BuildExportFileName(result.Value!, "pdf");
            return File(bytes, "application/pdf", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export participants (PDF) for session {SessionId}", sessionId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while exporting the participant list."));
        }
    }

    private static string BuildExportFileName(SessionParticipantExportDto data, string extension)
    {
        var safeTitle = string.Concat((data.TrainingTitle + "-" + data.PartTitle)
            .Where(c => char.IsLetterOrDigit(c) || c is '-' or '_'));
        if (string.IsNullOrWhiteSpace(safeTitle)) safeTitle = "session";
        return $"participants-{safeTitle}-{data.StartUtc:yyyyMMdd}.{extension}";
    }

    /// <summary>Add a session to a Part. Returns the new session id and any room conflict warnings.</summary>
    [HttpPost("trainings/{trainingId:guid}/parts/{partId:guid}/sessions")]
    [ProducesResponseType(typeof(ApiResponse<AddSessionResult>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddSession(
        Guid trainingId, Guid partId, [FromBody] CreateSessionRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new AddSessionCommand(
                trainingId, partId, request.StartUtc, request.EndUtc, request.Room, request.MaxCapacity,
                request.Notes, request.TrainerEmployeeId, request.TrainerName, request.TrainerEmail,
                request.ExternalTrainerCost, request.VenueCost, request.MaterialsCost, request.OtherCost),
                cancellationToken);

            if (result.IsFailure)
                return result.Error.Code.EndsWith("NotFound")
                    ? NotFound(ApiResponse.Failure(result.Error.Message))
                    : BadRequest(ApiResponse.Failure(result.Error.Message));

            return StatusCode(StatusCodes.Status201Created, ApiResponse<AddSessionResult>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to add session to part {PartId}", partId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while adding the session."));
        }
    }

    /// <summary>Update a session's timing, room, capacity, notes, or trainer. Returns conflict warnings.</summary>
    [HttpPut("sessions/{sessionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<UpdateSessionResult>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateSession(
        Guid sessionId, [FromBody] UpdateSessionRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new UpdateSessionCommand(
                sessionId, request.StartUtc, request.EndUtc, request.Room, request.MaxCapacity,
                request.Notes, request.TrainerEmployeeId, request.TrainerName, request.TrainerEmail,
                request.ExternalTrainerCost, request.VenueCost, request.MaterialsCost, request.OtherCost),
                cancellationToken);

            if (result.IsFailure)
                return result.Error.Code.EndsWith("NotFound")
                    ? NotFound(ApiResponse.Failure(result.Error.Message))
                    : BadRequest(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse<UpdateSessionResult>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update session {SessionId}", sessionId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating the session."));
        }
    }

    /// <summary>Reschedule a session (Start/End only) — the drag/drop entry point on the planning calendar.</summary>
    [HttpPatch("sessions/{sessionId:guid}/schedule")]
    [ProducesResponseType(typeof(ApiResponse<UpdateSessionResult>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RescheduleSession(
        Guid sessionId, [FromBody] RescheduleSessionRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new RescheduleSessionCommand(sessionId, request.StartUtc, request.EndUtc), cancellationToken);

            if (result.IsFailure)
                return result.Error.Code.EndsWith("NotFound")
                    ? NotFound(ApiResponse.Failure(result.Error.Message))
                    : BadRequest(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse<UpdateSessionResult>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reschedule session {SessionId}", sessionId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while rescheduling the session."));
        }
    }

    /// <summary>Cancel a session with a required reason.</summary>
    [HttpPost("sessions/{sessionId:guid}/cancel")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelSession(
        Guid sessionId, [FromBody] CancelSessionRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new CancelSessionCommand(sessionId, request.Reason), cancellationToken);
            if (result.IsFailure)
                return result.Error.Code.EndsWith("NotFound")
                    ? NotFound(ApiResponse.Failure(result.Error.Message))
                    : BadRequest(ApiResponse.Failure(result.Error.Message));
            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to cancel session {SessionId}", sessionId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while cancelling the session."));
        }
    }

    /// <summary>Duplicate a session, optionally creating multiple recurring occurrences.</summary>
    [HttpPost("sessions/{sessionId:guid}/duplicate")]
    [ProducesResponseType(typeof(ApiResponse<DuplicateSessionResult>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DuplicateSession(
        Guid sessionId, [FromBody] DuplicateSessionRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new DuplicateSessionCommand(
                sessionId, request.NewStartUtc, request.Occurrences, request.IntervalDays), cancellationToken);

            if (result.IsFailure)
                return result.Error.Code.EndsWith("NotFound")
                    ? NotFound(ApiResponse.Failure(result.Error.Message))
                    : BadRequest(ApiResponse.Failure(result.Error.Message));

            return StatusCode(StatusCodes.Status201Created, ApiResponse<DuplicateSessionResult>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to duplicate session {SessionId}", sessionId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while duplicating the session."));
        }
    }

    /// <summary>Detect room conflicts for a candidate window across the platform.</summary>
    [HttpGet("sessions/conflicts")]
    [ProducesResponseType(typeof(ApiResponse<List<RoomConflictItem>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> DetectConflicts(
        [FromQuery] string room,
        [FromQuery] DateTime startUtc,
        [FromQuery] DateTime endUtc,
        [FromQuery] Guid? excludeSessionId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new DetectRoomConflictsQuery(room, startUtc, endUtc, excludeSessionId), cancellationToken);

            if (result.IsFailure)
                return BadRequest(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse<List<RoomConflictItem>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to detect room conflicts");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while detecting conflicts."));
        }
    }

    /// <summary>Generate (or regenerate) the rotating QR code for a session's attendance.</summary>
    [HttpPost("sessions/{sessionId:guid}/qr-code")]
    [ProducesResponseType(typeof(ApiResponse<SessionQrCodeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GenerateQrCode(
        Guid sessionId,
        [FromBody] GenerateSessionQrCodeRequest? request,
        CancellationToken cancellationToken)
    {
        try
        {
            var regenerate = request?.Regenerate ?? false;
            var result = await _sender.Send(new GenerateSessionQrCodeCommand(sessionId, regenerate), cancellationToken);
            if (result.IsFailure)
                return result.Error.Code.EndsWith("NotFound")
                    ? NotFound(ApiResponse.Failure(result.Error.Message))
                    : BadRequest(ApiResponse.Failure(result.Error.Message));
            return Ok(ApiResponse<SessionQrCodeDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate QR code for session {SessionId}", sessionId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while generating the QR code."));
        }
    }

    /// <summary>Get the current QR payload for a session (admin polling). Returns 404 if not generated.</summary>
    [HttpGet("sessions/{sessionId:guid}/qr-code")]
    [ProducesResponseType(typeof(ApiResponse<SessionQrCodeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetQrCode(Guid sessionId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetSessionQrCodeQuery(sessionId), cancellationToken);
            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));
            return Ok(ApiResponse<SessionQrCodeDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve QR code for session {SessionId}", sessionId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the QR code."));
        }
    }

    /// <summary>Revoke a session's QR code (no further scans accepted).</summary>
    [HttpDelete("sessions/{sessionId:guid}/qr-code")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RevokeQrCode(Guid sessionId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new RevokeSessionQrCodeCommand(sessionId), cancellationToken);
            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));
            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to revoke QR code for session {SessionId}", sessionId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while revoking the QR code."));
        }
    }
}
