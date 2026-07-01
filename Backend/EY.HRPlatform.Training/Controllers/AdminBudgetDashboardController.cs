using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Admin.Budget.Export;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/admin/budgets/dashboard")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminBudgetDashboardController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminBudgetDashboardController> _logger;
    private readonly IBudgetReportExporter _exporter;

    public AdminBudgetDashboardController(
        ISender sender,
        ILogger<AdminBudgetDashboardController> logger,
        IBudgetReportExporter exporter)
    {
        _sender = sender;
        _logger = logger;
        _exporter = exporter;
    }

    /// <summary>Budget-vs-spend KPIs + per-service-line breakdown + threshold alerts for a period.</summary>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(ApiResponse<BudgetDashboardSummaryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSummary(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] Guid? serviceLineId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetBudgetDashboardSummaryQuery(from, to, serviceLineId), cancellationToken);
            if (result.IsFailure)
                return BadRequest(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse<BudgetDashboardSummaryDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve budget dashboard summary");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the budget dashboard."));
        }
    }

    /// <summary>Monthly external-spend trend (calendar-month buckets by session date).</summary>
    [HttpGet("trend")]
    [ProducesResponseType(typeof(ApiResponse<BudgetTrendDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTrend(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] Guid? serviceLineId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetBudgetSpendTrendQuery(from, to, serviceLineId), cancellationToken);
            if (result.IsFailure)
                return BadRequest(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse<BudgetTrendDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve budget spend trend");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the spend trend."));
        }
    }

    /// <summary>Spending drill-down for one service line: contributing external sessions.</summary>
    [HttpGet("detail")]
    [ProducesResponseType(typeof(ApiResponse<BudgetSpendDetailDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDetail(
        [FromQuery] Guid serviceLineId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetBudgetSpendDetailQuery(serviceLineId, from, to), cancellationToken);
            if (result.IsFailure)
                return BadRequest(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse<BudgetSpendDetailDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve budget spend detail for service line {ServiceLineId}", serviceLineId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the spending detail."));
        }
    }

    /// <summary>Export the budget report (honoring the current filters) as Excel (.xlsx).</summary>
    [HttpGet("export/excel")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] Guid? serviceLineId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetBudgetReportForExportQuery(from, to, serviceLineId), cancellationToken);
            if (result.IsFailure)
                return BadRequest(ApiResponse.Failure(result.Error.Message));

            var bytes = _exporter.ToExcel(result.Value!);
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                BuildFileName(result.Value!, "xlsx"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export budget report (Excel)");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while exporting the budget report."));
        }
    }

    /// <summary>Export the budget report (honoring the current filters) as a branded PDF.</summary>
    [HttpGet("export/pdf")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportPdf(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] Guid? serviceLineId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetBudgetReportForExportQuery(from, to, serviceLineId), cancellationToken);
            if (result.IsFailure)
                return BadRequest(ApiResponse.Failure(result.Error.Message));

            var bytes = _exporter.ToPdf(result.Value!);
            return File(bytes, "application/pdf", BuildFileName(result.Value!, "pdf"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export budget report (PDF)");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while exporting the budget report."));
        }
    }

    private static string BuildFileName(BudgetReportDto data, string extension)
    {
        static string Slug(string s)
        {
            var cleaned = new string(s.Select(ch => char.IsLetterOrDigit(ch) ? ch : '_').ToArray());
            return string.Join("_", cleaned.Split('_', StringSplitOptions.RemoveEmptyEntries));
        }

        return $"Budget_Training_{Slug(data.ServiceLineFilter)}_{Slug(data.PeriodLabel)}.{extension}";
    }
}
