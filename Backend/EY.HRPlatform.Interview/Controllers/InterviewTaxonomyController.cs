using EY.HRPlatform.Interview.Features.Taxonomy;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Taxonomy;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Interview.Controllers;

[ApiController]
[Route("api/interview/taxonomy")]
public class InterviewTaxonomyController(IInterviewTaxonomyService taxonomyService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<InterviewTaxonomyDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var data = await taxonomyService.GetAsync(cancellationToken);
        return Ok(ApiResponse<InterviewTaxonomyDto>.Success(data));
    }

    [HttpPut]
    [ProducesResponseType(typeof(ApiResponse<InterviewTaxonomyDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Save(
        [FromBody] UpdateInterviewTaxonomyDto request,
        CancellationToken cancellationToken)
    {
        var data = await taxonomyService.SaveAsync(request, cancellationToken);
        return Ok(ApiResponse<InterviewTaxonomyDto>.Success(data));
    }
}
