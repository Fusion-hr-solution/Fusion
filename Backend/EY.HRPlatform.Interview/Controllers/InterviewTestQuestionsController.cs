using EY.HRPlatform.Interview.Features.TestQuestions;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Questions;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Interview.Controllers;

[ApiController]
[Route("api/interview/tests/{id:guid}/questions")]
public class InterviewTestQuestionsController(ITestQuestionService testQuestionService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<QuestionDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var data = await testQuestionService.GetQuestionsAsync(id, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<QuestionDto>>.Success(data));
    }

    [HttpPost("{questionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> AddQuestion(Guid id, Guid questionId, CancellationToken cancellationToken)
    {
        await testQuestionService.AddQuestionAsync(id, questionId, cancellationToken);
        return Ok(ApiResponse.Success());
    }

    [HttpDelete("{questionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> RemoveQuestion(Guid id, Guid questionId, CancellationToken cancellationToken)
    {
        await testQuestionService.RemoveQuestionAsync(id, questionId, cancellationToken);
        return Ok(ApiResponse.Success());
    }
}