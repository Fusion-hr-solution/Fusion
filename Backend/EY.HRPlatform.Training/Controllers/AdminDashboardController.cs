using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/admin/dashboard")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminDashboardController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminDashboardController> _logger;

    public AdminDashboardController(ISender sender, ILogger<AdminDashboardController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Get the programme matrix with employee counts and completion rates per grade × service line cell.</summary>
    [HttpGet("programme-matrix")]
    [ProducesResponseType(typeof(ApiResponse<ProgrammeMatrixDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProgrammeMatrix(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetProgrammeMatrixQuery(), cancellationToken);
            return Ok(ApiResponse<ProgrammeMatrixDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve programme matrix");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the programme matrix."));
        }
    }

    /// <summary>Get completion rates aggregated by grade.</summary>
    [HttpGet("completion-by-grade")]
    [ProducesResponseType(typeof(ApiResponse<List<CompletionByGradeDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCompletionByGrade(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetCompletionByGradeQuery(), cancellationToken);
            return Ok(ApiResponse<List<CompletionByGradeDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve completion by grade");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving completion data by grade."));
        }
    }

    /// <summary>Get completion rates aggregated by service line.</summary>
    [HttpGet("completion-by-service-line")]
    [ProducesResponseType(typeof(ApiResponse<List<CompletionByServiceLineDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCompletionByServiceLine(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetCompletionByServiceLineQuery(), cancellationToken);
            return Ok(ApiResponse<List<CompletionByServiceLineDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve completion by service line");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving completion data by service line."));
        }
    }

    /// <summary>Get monthly completion trend over the last 12 months.</summary>
    [HttpGet("completion-trend")]
    [ProducesResponseType(typeof(ApiResponse<CompletionTrendDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCompletionTrend(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetCompletionTrendQuery(), cancellationToken);
            return Ok(ApiResponse<CompletionTrendDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve completion trend");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the completion trend."));
        }
    }

    /// <summary>Get the list of employees for a specific grade × service line cell.</summary>
    [HttpGet("cell-employees")]
    [ProducesResponseType(typeof(ApiResponse<List<CellEmployeeDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCellEmployees(
        [FromQuery] Guid gradeId,
        [FromQuery] Guid serviceLineId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new GetCellEmployeesQuery(gradeId, serviceLineId), cancellationToken);
            return Ok(ApiResponse<List<CellEmployeeDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve cell employees");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving cell employees."));
        }
    }
}
