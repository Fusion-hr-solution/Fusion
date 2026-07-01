using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/admin/budgets")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminBudgetsController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminBudgetsController> _logger;

    public AdminBudgetsController(ISender sender, ILogger<AdminBudgetsController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>List training budgets (optionally filtered by service line / period type) with derived spend.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<TrainingBudgetDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? serviceLineId,
        [FromQuery] string? periodType,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetTrainingBudgetsQuery(serviceLineId, periodType), cancellationToken);
            if (result.IsFailure)
                return BadRequest(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse<List<TrainingBudgetDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve training budgets");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving training budgets."));
        }
    }

    /// <summary>Create a new training budget for a service line and period.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateTrainingBudgetRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new CreateTrainingBudgetCommand(
                    request.ServiceLineId, request.PeriodType,
                    request.PeriodStart, request.PeriodEnd, request.AllocatedAmount),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("Overlap"))
                    return Conflict(ApiResponse.Failure(result.Error.Message));
                if (result.Error.Code.Contains("NotFound"))
                    return NotFound(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<Guid>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create training budget");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while creating the training budget."));
        }
    }

    /// <summary>Update an existing training budget (service line is immutable).</summary>
    [HttpPut("{budgetId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        Guid budgetId, [FromBody] UpdateTrainingBudgetRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new UpdateTrainingBudgetCommand(
                    budgetId, request.PeriodType,
                    request.PeriodStart, request.PeriodEnd, request.AllocatedAmount),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound"))
                    return NotFound(ApiResponse.Failure(result.Error.Message));
                if (result.Error.Code.Contains("Overlap"))
                    return Conflict(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update training budget {BudgetId}", budgetId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating the training budget."));
        }
    }

    /// <summary>Delete a training budget.</summary>
    [HttpDelete("{budgetId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid budgetId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new DeleteTrainingBudgetCommand(budgetId), cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound"))
                    return NotFound(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete training budget {BudgetId}", budgetId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while deleting the training budget."));
        }
    }
}
