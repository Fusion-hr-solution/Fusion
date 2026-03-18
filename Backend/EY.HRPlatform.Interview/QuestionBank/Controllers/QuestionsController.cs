using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using EY.HRPlatform.Interview.QuestionBank.Application.Commands;
using EY.HRPlatform.Interview.QuestionBank.Application.Queries;
using EY.HRPlatform.Interview.QuestionBank.Models.Requests;
using EY.HRPlatform.Interview.QuestionBank.Models.Responses;

namespace EY.HRPlatform.Interview.QuestionBank.Controllers;

[ApiController]
[Route("api/interview/questions")]
[Authorize]
public class QuestionsController : ControllerBase
{
    private readonly IMediator _mediator;

    public QuestionsController(IMediator mediator)
    {
        _mediator = mediator;
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

        var query = new GetQuestionsQuery(page, pageSize, search, types, difficulties, sortBy);
        var result = await _mediator.Send(query);

        return Ok(result);
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<ActionResult<QuestionDto>> GetQuestion(Guid id)
    {
        var query = new GetQuestionByIdQuery(id);
        var result = await _mediator.Send(query);

        if (result == null)
            return NotFound(new { message = "Question not found" });

        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<QuestionDto>> CreateQuestion(CreateQuestionRequest request)
    {
        var command = new CreateQuestionCommand(request);
        var result = await _mediator.Send(command);

        return CreatedAtAction(nameof(GetQuestion), new { id = result.Id }, result);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<QuestionDto>> UpdateQuestion(Guid id, CreateQuestionRequest request)
    {
        var command = new UpdateQuestionCommand(id, request);
        var result = await _mediator.Send(command);

        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteQuestion(Guid id)
    {
        var command = new DeleteQuestionCommand(id);
        await _mediator.Send(command);

        return NoContent();
    }
}