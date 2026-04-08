using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/admin/article-templates")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminArticleTemplatesController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminArticleTemplatesController> _logger;

    public AdminArticleTemplatesController(ISender sender, ILogger<AdminArticleTemplatesController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>List all article templates with their sections.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<ArticleTemplateDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetArticleTemplatesQuery(), cancellationToken);
            return Ok(ApiResponse<List<ArticleTemplateDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve article templates");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving article templates."));
        }
    }
}
