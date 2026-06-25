using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Features.Admin.Reports.Export;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

/// <summary>
/// US-8.2.1 / US-8.2.2 — advanced reporting. Per-employee attendance &amp; training-hours reports
/// and the in-person vs e-learning comparison, with Excel export. Admin-only. PDF export (with
/// embedded charts) is added in a later slice.
/// </summary>
[ApiController]
[Route("api/training/admin/reports")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminReportsController : ControllerBase
{
    private const string ExcelContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private readonly ISender _sender;
    private readonly IReportExporter _exporter;

    public AdminReportsController(ISender sender, IReportExporter exporter)
    {
        _sender = sender;
        _exporter = exporter;
    }

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

    // ── Excel exports (US-8.2.1/8.2.2) ───────────────────────────────────────
    // Display labels for grade/service-line/training are passed by the client (it has them from its
    // filter dropdowns) so the export header is human-readable without extra server lookups.

    /// <summary>US-8.2.1 — attendance report as Excel.</summary>
    [HttpGet("attendance/by-employee/excel")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportAttendanceByEmployee(
        [FromQuery] Guid? gradeId,
        [FromQuery] Guid? serviceLineId,
        [FromQuery] Guid? trainingId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? gradeLabel,
        [FromQuery] string? serviceLineLabel,
        [FromQuery] string? trainingLabel,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new GetAttendanceByEmployeeQuery(new AttendanceFilter(gradeId, serviceLineId, trainingId, from, to)),
            cancellationToken);

        var bytes = _exporter.AttendanceByEmployeeToExcel(
            result.Value!,
            BuildFilterLines(gradeLabel, serviceLineLabel, trainingLabel, from, to));

        return File(bytes, ExcelContentType, $"attendance-report-{DateTime.UtcNow:yyyy-MM-dd}.xlsx");
    }

    /// <summary>US-8.2.1 — training-hours report as Excel.</summary>
    [HttpGet("hours/by-employee/excel")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportHoursByEmployee(
        [FromQuery] Guid? gradeId,
        [FromQuery] Guid? serviceLineId,
        [FromQuery] Guid? trainingId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? gradeLabel,
        [FromQuery] string? serviceLineLabel,
        [FromQuery] string? trainingLabel,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new GetTrainingHoursByEmployeeQuery(new AttendanceFilter(gradeId, serviceLineId, trainingId, from, to)),
            cancellationToken);

        var bytes = _exporter.TrainingHoursByEmployeeToExcel(
            result.Value!,
            BuildFilterLines(gradeLabel, serviceLineLabel, trainingLabel, from, to));

        return File(bytes, ExcelContentType, $"training-hours-report-{DateTime.UtcNow:yyyy-MM-dd}.xlsx");
    }

    /// <summary>US-8.2.2 — in-person vs e-learning comparison as Excel.</summary>
    [HttpGet("completion/by-format/excel")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportCompletionByFormat(
        [FromQuery] Guid? gradeId,
        [FromQuery] Guid? serviceLineId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? gradeLabel,
        [FromQuery] string? serviceLineLabel,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new GetCompletionByFormatQuery(new CompletionByFormatFilter(gradeId, serviceLineId, from, to)),
            cancellationToken);

        var bytes = _exporter.FormatComparisonToExcel(
            result.Value!,
            BuildFilterLines(gradeLabel, serviceLineLabel, null, from, to));

        return File(bytes, ExcelContentType, $"format-comparison-{DateTime.UtcNow:yyyy-MM-dd}.xlsx");
    }

    private static List<ReportFilterLine> BuildFilterLines(
        string? gradeLabel, string? serviceLineLabel, string? trainingLabel, DateTime? from, DateTime? to)
    {
        var lines = new List<ReportFilterLine>();
        if (!string.IsNullOrWhiteSpace(gradeLabel)) lines.Add(new ReportFilterLine("Grade", gradeLabel));
        if (!string.IsNullOrWhiteSpace(serviceLineLabel)) lines.Add(new ReportFilterLine("Service Line", serviceLineLabel));
        if (!string.IsNullOrWhiteSpace(trainingLabel)) lines.Add(new ReportFilterLine("Training", trainingLabel));
        if (from.HasValue) lines.Add(new ReportFilterLine("From", from.Value.ToString("yyyy-MM-dd")));
        if (to.HasValue) lines.Add(new ReportFilterLine("To", to.Value.ToString("yyyy-MM-dd")));
        lines.Add(new ReportFilterLine("Generated (UTC)", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm")));
        return lines;
    }
}
