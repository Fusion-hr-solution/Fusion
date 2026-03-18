using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Infrastructure.Repositories;
using EY.HRPlatform.Interview.Models;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Interview.Tests.Controllers;

[ApiController]
[Route("api/interview/tests")]
[Authorize]
public class InterviewTestsController : ControllerBase
{
    private readonly IInterviewTestRepository _repository;

    public InterviewTestsController(IInterviewTestRepository repository)
    {
        _repository = repository;
    }

    [HttpPost]
    public async Task<ActionResult<InterviewTestDto>> CreateTest(CreateInterviewTestRequest request)
    {
        var test = new InterviewTest
        {
            Title = request.Title,
            Role = request.Role,
            Discipline = request.Discipline,
            Description = request.Description,
            DifficultyLevel = request.DifficultyLevel,
            EstimatedDurationMinutes = request.EstimatedDurationMinutes,
            InternalNotes = request.InternalNotes,
            Status = "Draft",
            IsActive = true,
            Config = new InterviewTestConfig
            {
                TimeLimitEnabled = true,
                TimeLimitMinutes = 60,
                MaxAttempts = 1,
                RandomizeOrder = false,
                AccessType = "Public",
                PassingThresholdPercent = 70,
                AllowPartialCredit = true
            }
        };

        var created = await _repository.AddAsync(test);
        return CreatedAtAction(nameof(GetTest), new { id = created.Id }, MapToDto(created));
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<ActionResult<InterviewTestDto>> GetTest(Guid id)
    {
        var test = await _repository.GetByIdAsync(id);

        if (test == null)
            return NotFound(new { message = "Test not found" });

        return Ok(MapToDto(test));
    }

    [HttpGet("drafts")]
    public async Task<ActionResult<List<InterviewTestDto>>> GetDrafts()
    {
        var userId = Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
        var tests = await _repository.GetDraftsByUserAsync(userId);

        return Ok(tests.Select(MapToDto).ToList());
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<InterviewTestDto>> UpdateTest(Guid id, UpdateInterviewTestRequest request)
    {
        var test = await _repository.GetByIdAsync(id);
        if (test == null)
            return NotFound(new { message = "Test not found" });

        if (!string.IsNullOrEmpty(request.Title))
            test.Title = request.Title;
        if (!string.IsNullOrEmpty(request.Role))
            test.Role = request.Role;
        if (!string.IsNullOrEmpty(request.Discipline))
            test.Discipline = request.Discipline;
        if (!string.IsNullOrEmpty(request.Description))
            test.Description = request.Description;
        if (!string.IsNullOrEmpty(request.DifficultyLevel))
            test.DifficultyLevel = request.DifficultyLevel;
        if (request.EstimatedDurationMinutes.HasValue)
            test.EstimatedDurationMinutes = request.EstimatedDurationMinutes.Value;
        if (request.InternalNotes != null)
            test.InternalNotes = request.InternalNotes;

        var updated = await _repository.UpdateAsync(test);
        return Ok(MapToDto(updated));
    }

    [HttpPut("{id}/questions")]
    public async Task<ActionResult<InterviewTestDto>> UpdateTestQuestions(Guid id, UpdateTestQuestionsRequest request)
    {
        var test = await _repository.GetByIdAsync(id);
        if (test == null)
            return NotFound(new { message = "Test not found" });

        test.Questions.Clear();
        foreach (var q in request.Questions)
        {
            test.Questions.Add(new InterviewTestQuestion
            {
                QuestionId = q.QuestionId,
                SortOrder = q.SortOrder,
                PointsOverride = q.PointsOverride,
                DurationOverrideMinutes = q.DurationOverrideMinutes
            });
        }

        var updated = await _repository.UpdateAsync(test);
        return Ok(MapToDto(updated));
    }

    [HttpPost("{id}/publish")]
    public async Task<ActionResult<InterviewTestDto>> PublishTest(Guid id)
    {
        var test = await _repository.GetByIdAsync(id);
        if (test == null)
            return NotFound(new { message = "Test not found" });

        if (!test.Questions.Any())
            return BadRequest(new { message = "Cannot publish a test with no questions" });

        test.Status = "Published";
        var updated = await _repository.UpdateAsync(test);
        return Ok(MapToDto(updated));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTest(Guid id)
    {
        await _repository.DeleteAsync(id);
        return NoContent();
    }

    private static InterviewTestDto MapToDto(InterviewTest test)
    {
        return new InterviewTestDto
        {
            Id = test.Id,
            Title = test.Title,
            Role = test.Role,
            Discipline = test.Discipline,
            Description = test.Description,
            DifficultyLevel = test.DifficultyLevel,
            EstimatedDurationMinutes = test.EstimatedDurationMinutes,
            InternalNotes = test.InternalNotes,
            Status = test.Status,
            CreatedAt = test.CreatedAt,
            UpdatedAt = test.UpdatedAt,
            Config = test.Config == null ? null : new InterviewTestConfigDto
            {
                Id = test.Config.Id,
                TimeLimitEnabled = test.Config.TimeLimitEnabled,
                TimeLimitMinutes = test.Config.TimeLimitMinutes,
                MaxAttempts = test.Config.MaxAttempts,
                RandomizeOrder = test.Config.RandomizeOrder,
                AccessType = test.Config.AccessType,
                StartDate = test.Config.StartDate,
                EndDate = test.Config.EndDate,
                LinkExpiry = test.Config.LinkExpiry,
                PassingThresholdPercent = test.Config.PassingThresholdPercent,
                AllowPartialCredit = test.Config.AllowPartialCredit,
                AssignedReviewerId = test.Config.AssignedReviewerId
            },
            Questions = test.Questions.Select(q => new InterviewTestQuestionDto
            {
                Id = q.Id,
                QuestionId = q.QuestionId,
                SortOrder = q.SortOrder,
                PointsOverride = q.PointsOverride,
                DurationOverrideMinutes = q.DurationOverrideMinutes
            }).ToList()
        };
    }
}