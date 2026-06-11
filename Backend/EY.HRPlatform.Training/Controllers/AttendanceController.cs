using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

/// <summary>
/// US-5.3.2 — Attendance dashboards. Per-session (AC#1), per-employee (AC#2),
/// and grade/period aggregations (AC#3). Admin-only.
/// </summary>
[ApiController]
[Route("api/training/admin/attendance")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AttendanceController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AttendanceController> _logger;

    public AttendanceController(ISender sender, ILogger<AttendanceController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>AC#1 — present/absent/pending breakdown for a single session.</summary>
    [HttpGet("sessions/{sessionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<SessionAttendanceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSessionAttendance(
        Guid sessionId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetSessionAttendanceQuery(sessionId), cancellationToken);
        if (result.IsFailure)
            return NotFound(ApiResponse.Failure(result.Error.Message));

        return Ok(ApiResponse<SessionAttendanceDto>.Success(result.Value!));
    }

    /// <summary>AC#2 — a single employee's attendance history with optional date range.</summary>
    [HttpGet("employees/{employeeId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeAttendanceHistoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetEmployeeAttendance(
        Guid employeeId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new GetEmployeeAttendanceHistoryQuery(employeeId, from, to), cancellationToken);

        return Ok(ApiResponse<EmployeeAttendanceHistoryDto>.Success(result.Value!));
    }

    /// <summary>AC#3 — attendance rate per grade (bar chart).</summary>
    [HttpGet("by-grade")]
    [ProducesResponseType(typeof(ApiResponse<List<AttendanceByGradeDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByGrade(
        [FromQuery] Guid? gradeId,
        [FromQuery] Guid? serviceLineId,
        [FromQuery] Guid? trainingId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new GetAttendanceByGradeQuery(new AttendanceFilter(gradeId, serviceLineId, trainingId, from, to)),
            cancellationToken);

        return Ok(ApiResponse<List<AttendanceByGradeDto>>.Success(result.Value!));
    }

    /// <summary>AC#3 — monthly attendance-rate trend (line chart).</summary>
    [HttpGet("trend")]
    [ProducesResponseType(typeof(ApiResponse<AttendanceTrendDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTrend(
        [FromQuery] Guid? gradeId,
        [FromQuery] Guid? serviceLineId,
        [FromQuery] Guid? trainingId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new GetAttendanceTrendQuery(new AttendanceFilter(gradeId, serviceLineId, trainingId, from, to)),
            cancellationToken);

        return Ok(ApiResponse<AttendanceTrendDto>.Success(result.Value!));
    }

    /// <summary>AC#3 — Grade × Month attendance-rate heatmap.</summary>
    [HttpGet("heatmap")]
    [ProducesResponseType(typeof(ApiResponse<AttendanceHeatmapDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetHeatmap(
        [FromQuery] Guid? gradeId,
        [FromQuery] Guid? serviceLineId,
        [FromQuery] Guid? trainingId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new GetAttendanceHeatmapQuery(new AttendanceFilter(gradeId, serviceLineId, trainingId, from, to)),
            cancellationToken);

        return Ok(ApiResponse<AttendanceHeatmapDto>.Success(result.Value!));
    }

    /// <summary>AC#3 — KPI cards: overall rate, total sessions, total hours delivered.</summary>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(ApiResponse<AttendanceSummaryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSummary(
        [FromQuery] Guid? gradeId,
        [FromQuery] Guid? serviceLineId,
        [FromQuery] Guid? trainingId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new GetAttendanceSummaryQuery(new AttendanceFilter(gradeId, serviceLineId, trainingId, from, to)),
            cancellationToken);

        return Ok(ApiResponse<AttendanceSummaryDto>.Success(result.Value!));
    }
}
