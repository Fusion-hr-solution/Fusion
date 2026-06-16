using EY.HRPlatform.SharedKernel.Auth;
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

    public AdminBudgetDashboardController(ISender sender, ILogger<AdminBudgetDashboardController> logger)
    {
        _sender = sender;
        _logger = logger;
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
}
