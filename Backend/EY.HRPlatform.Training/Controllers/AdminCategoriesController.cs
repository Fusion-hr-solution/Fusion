using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Features.Catalog.Queries;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/admin/categories")]
[Authorize(Roles = "Admin,HR")]
public class AdminCategoriesController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminCategoriesController> _logger;

    public AdminCategoriesController(ISender sender, ILogger<AdminCategoriesController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>List all categories (reuses catalog query).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<TrainingCategoryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetCategoriesQuery(), cancellationToken);
            return Ok(ApiResponse<List<TrainingCategoryDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve categories");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving categories."));
        }
    }

    /// <summary>Create a new category.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(
        [FromBody] CreateCategoryRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new CreateCategoryCommand(request.Name, request.Description), cancellationToken);

            if (result.IsFailure)
                return BadRequest(ApiResponse.Failure(result.Error.Message));

            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<Guid>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create category");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while creating the category."));
        }
    }

    /// <summary>Update a category.</summary>
    [HttpPut("{categoryId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid categoryId, [FromBody] UpdateCategoryRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new UpdateCategoryCommand(categoryId, request.Name, request.Description),
                cancellationToken);

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
            _logger.LogError(ex, "Failed to update category {CategoryId}", categoryId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating the category."));
        }
    }

    /// <summary>Delete a category (only if it has no trainings).</summary>
    [HttpDelete("{categoryId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid categoryId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new DeleteCategoryCommand(categoryId), cancellationToken);

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
            _logger.LogError(ex, "Failed to delete category {CategoryId}", categoryId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while deleting the category."));
        }
    }
}
