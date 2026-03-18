using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Infrastructure.Repositories;
using EY.HRPlatform.Interview.Models;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Interview.QuestionBank.Controllers;

[ApiController]
[Route("api/interview/questions")]
[Authorize]
public class QuestionsController : ControllerBase
{
    private readonly IQuestionRepository _repository;

    public QuestionsController(IQuestionRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<PaginatedResponse<QuestionDto>>> GetQuestions(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? type = null,
        [FromQuery] string? difficulty = null,
        [FromQuery] string? sortBy = null)
    {
        var types = !string.IsNullOrEmpty(type)
            ? type.Split(',').Select(t => t.Trim()).ToArray()
            : null;

        var difficulties = !string.IsNullOrEmpty(difficulty)
            ? difficulty.Split(',').Select(d => d.Trim()).ToArray()
            : null;

        var (items, total) = await _repository.GetPaginatedAsync(page, pageSize, search, types, difficulties, sortBy);

        var dtos = items.Select(MapToDto).ToList();

        return Ok(new PaginatedResponse<QuestionDto>
        {
            Items = dtos,
            Page = page,
            PageSize = pageSize,
            Total = total
        });
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<ActionResult<QuestionDto>> GetQuestion(Guid id)
    {
        var question = await _repository.GetByIdAsync(id);

        if (question == null)
            return NotFound(new { message = "Question not found" });

        return Ok(MapToDto(question));
    }

    [HttpPost]
    public async Task<ActionResult<QuestionDto>> CreateQuestion(CreateQuestionRequest request)
    {
        var question = new Question
        {
            Title = request.Title,
            Description = request.Description,
            Type = request.Type,
            Difficulty = request.Difficulty,
            GradingMethod = request.GradingMethod,
            Points = request.Points,
            DurationMinutes = request.DurationMinutes,
            Tags = request.Tags,
            IsActive = true
        };

        if (request.Options?.Any() == true)
        {
            question.Options = request.Options
                .Select(o => new QuestionOption
                {
                    Text = o.Text,
                    IsCorrect = o.IsCorrect,
                    SortOrder = o.SortOrder
                })
                .ToList();
        }

        var created = await _repository.AddAsync(question);
        return CreatedAtAction(nameof(GetQuestion), new { id = created.Id }, MapToDto(created));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<QuestionDto>> UpdateQuestion(Guid id, CreateQuestionRequest request)
    {
        var question = await _repository.GetByIdAsync(id);
        if (question == null)
            return NotFound(new { message = "Question not found" });

        question.Title = request.Title;
        question.Description = request.Description;
        question.Type = request.Type;
        question.Difficulty = request.Difficulty;
        question.GradingMethod = request.GradingMethod;
        question.Points = request.Points;
        question.DurationMinutes = request.DurationMinutes;
        question.Tags = request.Tags;

        if (request.Options?.Any() == true)
        {
            question.Options = request.Options
                .Select(o => new QuestionOption
                {
                    Text = o.Text,
                    IsCorrect = o.IsCorrect,
                    SortOrder = o.SortOrder
                })
                .ToList();
        }

        var updated = await _repository.UpdateAsync(question);
        return Ok(MapToDto(updated));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteQuestion(Guid id)
    {
        await _repository.DeleteAsync(id);
        return NoContent();
    }

    private static QuestionDto MapToDto(Question question)
    {
        return new QuestionDto
        {
            Id = question.Id,
            Title = question.Title,
            Description = question.Description,
            Type = question.Type,
            Difficulty = question.Difficulty,
            GradingMethod = question.GradingMethod,
            Points = question.Points,
            DurationMinutes = question.DurationMinutes,
            Tags = question.Tags,
            UsageCount = question.UsageCount,
            IsActive = question.IsActive,
            CreatedAt = question.CreatedAt,
            UpdatedAt = question.UpdatedAt,
            Options = question.Options?.Select(o => new QuestionOptionResponseDto
            {
                Id = o.Id,
                Text = o.Text,
                IsCorrect = o.IsCorrect,
                SortOrder = o.SortOrder
            }).OrderBy(o => o.SortOrder).ToList()
        };
    }
}