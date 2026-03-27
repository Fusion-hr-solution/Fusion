using EY.HRPlatform.Interview.Features.Tests;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Tests;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Interview.Controllers;

[ApiController]
[Route("api/interview/tests")]
public class InterviewTestsController(ITestService testService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResultDto<TestDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get([FromQuery] TestFilterDto filter, CancellationToken cancellationToken)
    {
        var data = await testService.GetAsync(filter, cancellationToken);
        return Ok(ApiResponse<PagedResultDto<TestDto>>.Success(data));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<TestDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var data = await testService.GetByIdAsync(id, cancellationToken);
        return Ok(ApiResponse<TestDto>.Success(data));
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<TestDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateTestDto request, CancellationToken cancellationToken)
    {
        var data = await testService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = data.Id }, ApiResponse<TestDto>.Success(data));
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<TestDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTestDto request, CancellationToken cancellationToken)
    {
        var data = await testService.UpdateAsync(id, request, cancellationToken);
        return Ok(ApiResponse<TestDto>.Success(data));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await testService.DeleteAsync(id, cancellationToken);
        return Ok(ApiResponse.Success());
    }
}
