using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

/// <summary>
/// US-8.2.1 / US-8.2.2 — advanced reporting. Per-employee attendance &amp; training-hours reports
/// and the in-person vs e-learning comparison. Admin-only. Excel/PDF export endpoints are added in
/// later slices.
/// </summary>
[ApiController]
[Route("api/training/admin/reports")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminReportsController : ControllerBase
{
    private readonly ISender _sender;

    public AdminReportsController(ISender sender) => _sender = sender;

    /// <summary>US-8.2.1 — attendance report, one row per employee.</summary>
    [HttpGet("attendance/by-employee")]
    [ProducesResponseType(typeof(ApiResponse<List<AttendanceByEmployeeRowDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAttendanceByEmployee(
        [FromQuery] Guid? gradeId,
        [FromQuery] Guid? serviceLineId,
        [FromQuery] Guid? trainingId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new GetAttendanceByEmployeeQuery(new AttendanceFilter(gradeId, serviceLineId, trainingId, from, to)),
            cancellationToken);

        return Ok(ApiResponse<List<AttendanceByEmployeeRowDto>>.Success(result.Value!));
    }

    /// <summary>US-8.2.1 — training-hours report, one row per employee.</summary>
    [HttpGet("hours/by-employee")]
    [ProducesResponseType(typeof(ApiResponse<List<TrainingHoursRowDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetHoursByEmployee(
        [FromQuery] Guid? gradeId,
        [FromQuery] Guid? serviceLineId,
        [FromQuery] Guid? trainingId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new GetTrainingHoursByEmployeeQuery(new AttendanceFilter(gradeId, serviceLineId, trainingId, from, to)),
            cancellationToken);

        return Ok(ApiResponse<List<TrainingHoursRowDto>>.Success(result.Value!));
    }

    /// <summary>US-8.2.2 — in-person vs e-learning comparison.</summary>
    [HttpGet("completion/by-format")]
    [ProducesResponseType(typeof(ApiResponse<FormatComparisonDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCompletionByFormat(
        [FromQuery] Guid? gradeId,
        [FromQuery] Guid? serviceLineId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new GetCompletionByFormatQuery(new CompletionByFormatFilter(gradeId, serviceLineId, from, to)),
            cancellationToken);

        return Ok(ApiResponse<FormatComparisonDto>.Success(result.Value!));
    }
}
