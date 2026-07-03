using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.TemplateCategories.Commands;
using EY.HRPlatform.Performance.Features.TemplateCategories.Dtos;
using EY.HRPlatform.Performance.Features.TemplateCategories.Queries;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/template-categories")]
[Authorize]
public class TemplateCategoriesController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetCategories([FromQuery] bool includeArchived = false, CancellationToken cancellationToken = default)
    {
        // Reading categories is a library concern: template authors browse and classify by
        // category without holding category-management permission.
        if (!accessPolicy.CanViewObjectiveLibrary(User) && !accessPolicy.CanManageTemplateCategories(User))
            return Forbid();

        var result = await sender.Send(new GetCategoriesQuery(includeArchived), cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<CategoryDto>>.Success(result.Value));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCategoryRequest request, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageTemplateCategories(User))
            return Forbid();

        var result = await sender.Send(new CreateCategoryCommand(User, request), cancellationToken);
        return result.IsSuccess ? Ok(ApiResponse<CategoryDto>.Success(result.Value)) : MapFailure(result.Error);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Rename(Guid id, [FromBody] RenameCategoryRequest request, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageTemplateCategories(User))
            return Forbid();

        var result = await sender.Send(new RenameCategoryCommand(id, User, request), cancellationToken);
        return result.IsSuccess ? Ok(ApiResponse<CategoryDto>.Success(result.Value)) : MapFailure(result.Error);
    }

    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageTemplateCategories(User))
            return Forbid();

        var result = await sender.Send(new ArchiveCategoryCommand(id, User), cancellationToken);
        return result.IsSuccess ? Ok(ApiResponse<CategoryDto>.Success(result.Value)) : MapFailure(result.Error);
    }

    [HttpPost("{id:guid}/reactivate")]
    public async Task<IActionResult> Reactivate(Guid id, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageTemplateCategories(User))
            return Forbid();

        var result = await sender.Send(new ReactivateCategoryCommand(id, User), cancellationToken);
        return result.IsSuccess ? Ok(ApiResponse<CategoryDto>.Success(result.Value)) : MapFailure(result.Error);
    }

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase))
            return NotFound(ApiResponse.Failure(error.Message));

        if (error.Code.Contains("Duplicate", StringComparison.OrdinalIgnoreCase))
            return Conflict(ApiResponse.Failure(error.Message));

        return BadRequest(ApiResponse.Failure(error.Message));
    }
}
