using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/admin/trainings")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminTrainingsController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminTrainingsController> _logger;

    public AdminTrainingsController(ISender sender, ILogger<AdminTrainingsController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>List all trainings (admin view with enrollment counts, supports soft-deleted).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResponse<AdminTrainingDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? categoryId,
        [FromQuery] string? search,
        [FromQuery] bool includeDeleted = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _sender.Send(
                new GetAdminTrainingsQuery(categoryId, search, includeDeleted, page, pageSize),
                cancellationToken);

            return Ok(ApiResponse<PagedResponse<AdminTrainingDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve admin trainings");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving trainings."));
        }
    }

    /// <summary>Get full training detail with chapters, exams, and enrollment info.</summary>
    [HttpGet("{trainingId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AdminTrainingDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDetail(Guid trainingId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new GetAdminTrainingDetailQuery(trainingId), cancellationToken);

            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse<AdminTrainingDetailDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve training detail {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the training."));
        }
    }

    /// <summary>Create a new training with optional chapters.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(
        [FromBody] CreateTrainingRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var chapters = request.Chapters.Select(c => new CreateTrainingChapterItem(
                c.Title, c.Layout, c.OrderIndex,
                c.ContentBlocks.Select(b => new CreateTrainingContentBlockItem(
                    b.Type, b.OrderIndex, b.Title, b.TextContent,
                    b.ContentUri, b.VideoUrl, b.EstimatedDurationMinutes)).ToList())).ToList();

            var result = await _sender.Send(
                new CreateTrainingCommand(request.Title, request.Description, request.Credits,
                    request.IsMandatory, request.BadgeLevel, request.Duration,
                    request.CategoryId, request.TrainingType, request.ScheduledDate, chapters,
                    request.OnSiteCourses.Select(c => new CreateOnSiteCourseItem(
                        c.Title, c.ContentUri, c.OrderIndex)).ToList(),
                    request.CostType, request.SponsoringServiceLineId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(ApiResponse.Failure(result.Error.Message));

            return CreatedAtAction(nameof(GetDetail), new { trainingId = result.Value },
                ApiResponse<Guid>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create training");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while creating the training."));
        }
    }

    /// <summary>Update an existing training's metadata.</summary>
    [HttpPut("{trainingId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid trainingId, [FromBody] UpdateTrainingRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new UpdateTrainingCommand(trainingId, request.Title, request.Description,
                    request.Credits, request.IsMandatory, request.BadgeLevel,
                    request.Duration, request.CategoryId, request.TrainingType, request.ScheduledDate,
                    request.CostType, request.SponsoringServiceLineId),
                cancellationToken);

            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating the training."));
        }
    }

    /// <summary>Soft-delete a training.</summary>
    [HttpDelete("{trainingId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid trainingId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new DeleteTrainingCommand(trainingId), cancellationToken);

            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while deleting the training."));
        }
    }

    // ── Chapter management (nested under training) ──

    /// <summary>Add a chapter to a training.</summary>
    [HttpPost("{trainingId:guid}/chapters")]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddChapter(
        Guid trainingId, [FromBody] CreateChapterRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new AddChapterCommand(trainingId, request.Title, request.Layout,
                    request.OrderIndex,
                    request.ContentBlocks.Select(b => new AddChapterContentBlockItem(
                        b.Type, b.OrderIndex, b.Title, b.TextContent,
                        b.ContentUri, b.VideoUrl, b.EstimatedDurationMinutes)).ToList()),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound"))
                    return NotFound(ApiResponse.Failure(result.Error.Message));
                if (result.Error.Code.Contains("Duplicate"))
                    return Conflict(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<Guid>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to add chapter to training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while adding the chapter."));
        }
    }

    /// <summary>Update a chapter.</summary>
    [HttpPut("{trainingId:guid}/chapters/{chapterId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateChapter(
        Guid trainingId, Guid chapterId,
        [FromBody] UpdateChapterRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new UpdateChapterCommand(trainingId, chapterId, request.Title,
                    request.Layout),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound"))
                    return NotFound(ApiResponse.Failure(result.Error.Message));
                if (result.Error.Code.Contains("Duplicate"))
                    return Conflict(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update chapter {ChapterId}", chapterId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating the chapter."));
        }
    }

    /// <summary>Delete a chapter.</summary>
    [HttpDelete("{trainingId:guid}/chapters/{chapterId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteChapter(
        Guid trainingId, Guid chapterId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new DeleteChapterCommand(trainingId, chapterId), cancellationToken);

            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete chapter {ChapterId}", chapterId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while deleting the chapter."));
        }
    }

    /// <summary>Reorder chapters within a training.</summary>
    [HttpPut("{trainingId:guid}/chapters/reorder")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ReorderChapters(
        Guid trainingId, [FromBody] ReorderChaptersRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new ReorderChaptersCommand(trainingId, request.ChapterIds),
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
            _logger.LogError(ex, "Failed to reorder chapters for training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while reordering chapters."));
        }
    }

    // ── Assignment management ──

    /// <summary>Get all assignments for a training.</summary>
    [HttpGet("{trainingId:guid}/assignments")]
    [ProducesResponseType(typeof(ApiResponse<List<AssignmentDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAssignments(Guid trainingId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new GetTrainingAssignmentsQuery(trainingId), cancellationToken);

            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse<List<AssignmentDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve assignments for training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving assignments."));
        }
    }

    /// <summary>Assign a training to an employee (HR-assigned).</summary>
    [HttpPost("{trainingId:guid}/assignments")]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AssignTraining(
        Guid trainingId, [FromBody] AssignTrainingRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new AssignTrainingCommand(trainingId, request.EmployeeId, request.DueDate),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound"))
                    return NotFound(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<Guid>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to assign training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while assigning the training."));
        }
    }

    // ── On-site course management ──

    [HttpPost("{trainingId:guid}/onsite-courses")]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddOnSiteCourse(
        Guid trainingId, [FromBody] CreateOnSiteCourseRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new AddOnSiteCourseCommand(trainingId, request.Title, request.ContentUri, request.OrderIndex),
                cancellationToken);
            if (result.IsFailure)
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            return StatusCode(StatusCodes.Status201Created, ApiResponse<Guid>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to add on-site course to training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while adding the on-site course."));
        }
    }

    [HttpPut("{trainingId:guid}/onsite-courses/{courseId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateOnSiteCourse(
        Guid trainingId, Guid courseId, [FromBody] CreateOnSiteCourseRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new UpdateOnSiteCourseCommand(trainingId, courseId, request.Title, request.ContentUri),
                cancellationToken);
            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));
            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update on-site course {CourseId}", courseId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating the on-site course."));
        }
    }

    [HttpDelete("{trainingId:guid}/onsite-courses/{courseId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteOnSiteCourse(
        Guid trainingId, Guid courseId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new DeleteOnSiteCourseCommand(trainingId, courseId), cancellationToken);
            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));
            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete on-site course {CourseId}", courseId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while deleting the on-site course."));
        }
    }

    [HttpPut("{trainingId:guid}/onsite-courses/reorder")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ReorderOnSiteCourses(
        Guid trainingId, [FromBody] ReorderOnSiteCoursesRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new ReorderOnSiteCoursesCommand(trainingId, request.CourseIds), cancellationToken);
            if (result.IsFailure)
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reorder on-site courses for training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while reordering on-site courses."));
        }
    }
}
