using EY.HRPlatform.Interview.Features.Questions;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Questions;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Interview.Controllers;

[ApiController]
[Route("api/interview/questions")]
public class QuestionsController(
    IQuestionService questionService,
    IQuestionGeneratorService questionGenerator) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResultDto<QuestionDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get([FromQuery] QuestionFilterDto filter, CancellationToken cancellationToken)
    {
        var data = await questionService.GetAsync(filter, cancellationToken);
        return Ok(ApiResponse<PagedResultDto<QuestionDto>>.Success(data));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<QuestionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var data = await questionService.GetByIdAsync(id, cancellationToken);
        return Ok(ApiResponse<QuestionDto>.Success(data));
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<QuestionDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateQuestionDto request, CancellationToken cancellationToken)
    {
        var data = await questionService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = data.Id }, ApiResponse<QuestionDto>.Success(data));
    }

    [HttpPost("generate")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CreateQuestionDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Generate([FromBody] GenerateQuestionsRequestDto request, CancellationToken cancellationToken)
    {
        var drafts = await questionGenerator.GenerateAsync(request, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<CreateQuestionDto>>.Success(drafts));
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<QuestionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateQuestionDto request, CancellationToken cancellationToken)
    {
        var data = await questionService.UpdateAsync(id, request, cancellationToken);
        return Ok(ApiResponse<QuestionDto>.Success(data));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await questionService.DeleteAsync(id, cancellationToken);
        return Ok(ApiResponse.Success());
    }
}