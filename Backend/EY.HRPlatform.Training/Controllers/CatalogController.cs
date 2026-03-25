using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.Training.Features.Catalog.Queries;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/catalog")]
[Authorize]
public class CatalogController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<CatalogController> _logger;

    public CatalogController(ISender sender, ILogger<CatalogController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Get all training categories.</summary>
    [HttpGet("categories")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<List<TrainingCategoryDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetCategories(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetCategoriesQuery(), cancellationToken);
            return Ok(ApiResponse<List<TrainingCategoryDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve training categories");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving categories."));
        }
    }

    /// <summary>Get all trainings, optionally filtered by category or search term.</summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<PagedResponse<TrainingDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? categoryId,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _sender.Send(
                new GetAllTrainingsQuery(categoryId, search, page, pageSize), cancellationToken);
            return Ok(ApiResponse<PagedResponse<TrainingDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve trainings");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving trainings."));
        }
    }

    /// <summary>Get detailed info for a single training by ID.</summary>
    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<TrainingDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetTrainingByIdQuery(id), cancellationToken);

            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse<TrainingDetailDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve training {TrainingId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the training."));
        }
    }
}
