using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Commands;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/objective-templates")]
[Authorize]
public class ObjectiveTemplatesController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? category,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanViewObjectiveLibrary(User))
        {
            return Forbid();
        }

        var result = await sender.Send(new GetObjectiveTemplatesQuery(search, status, category, page, pageSize), cancellationToken);
        return Ok(ApiResponse<PagedResponse<ObjectiveTemplateDto>>.Success(result));
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateObjectiveTemplateRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectiveLibrary(User))
        {
            return Forbid();
        }

        var result = await sender.Send(new CreateObjectiveTemplateCommand(
            request.Name, request.Description, request.Category, request.DefaultWeight), cancellationToken);

        if (result.IsFailure)
        {
            return MapFailure(result.Error);
        }

        SetETag(result.Value.Version);
        return Ok(ApiResponse<ObjectiveTemplateDto>.Success(result.Value));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateObjectiveTemplateRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectiveLibrary(User))
        {
            return Forbid();
        }

        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return PreconditionRequired();
        }

        var result = await sender.Send(new UpdateObjectiveTemplateCommand(
            id, expectedVersion, request.Name, request.Description, request.Category, request.DefaultWeight), cancellationToken);
        return ToResponse(result);
    }

    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(
        Guid id,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectiveLibrary(User))
        {
            return Forbid();
        }

        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return PreconditionRequired();
        }

        var result = await sender.Send(new ArchiveObjectiveTemplateCommand(id, expectedVersion), cancellationToken);
        return ToResponse(result);
    }

    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(
        Guid id,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectiveLibrary(User))
        {
            return Forbid();
        }

        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return PreconditionRequired();
        }

        var result = await sender.Send(new RestoreObjectiveTemplateCommand(id, expectedVersion), cancellationToken);
        return ToResponse(result);
    }

    private IActionResult ToResponse(Result<ObjectiveTemplateDto> result)
    {
        if (result.IsFailure)
        {
            return MapFailure(result.Error);
        }

        SetETag(result.Value.Version);
        return Ok(ApiResponse<ObjectiveTemplateDto>.Success(result.Value));
    }

    private void SetETag(uint version) => Response.Headers.ETag = $"\"{version}\"";

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(ApiResponse.Failure(error.Message));
        }

        if (error.Code.Contains("Invalid", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(ApiResponse.Failure(error.Message));
        }

        return Conflict(ApiResponse.Failure(error.Message));
    }

    private IActionResult PreconditionRequired()
        => StatusCode(StatusCodes.Status428PreconditionRequired,
            ApiResponse.Failure("If-Match header with the current version is required."));

    private static bool TryParseVersion(string? ifMatch, out uint version)
    {
        version = 0;
        if (string.IsNullOrWhiteSpace(ifMatch))
        {
            return false;
        }

        var trimmed = ifMatch.Trim().Trim('"');
        if (trimmed.StartsWith("W/", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[2..].Trim('"');
        }

        return uint.TryParse(trimmed, out version);
    }
}
