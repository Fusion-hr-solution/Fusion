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

    public CatalogController(ISender sender) => _sender = sender;

    /// <summary>Get all training categories.</summary>
    [HttpGet("categories")]
    [ProducesResponseType(typeof(ApiResponse<List<TrainingCategoryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCategories(CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetCategoriesQuery(), cancellationToken);
        return Ok(ApiResponse<List<TrainingCategoryDto>>.Success(result.Value!));
    }

    /// <summary>Get all trainings, optionally filtered by category or search term.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<TrainingDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? categoryId,
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetAllTrainingsQuery(categoryId, search), cancellationToken);
        return Ok(ApiResponse<List<TrainingDto>>.Success(result.Value!));
    }

    /// <summary>Get detailed info for a single training by ID.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<TrainingDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetTrainingByIdQuery(id), cancellationToken);

        if (result.IsFailure)
            return NotFound(ApiResponse.Failure(result.Error.Message));

        return Ok(ApiResponse<TrainingDetailDto>.Success(result.Value!));
    }
}
