using EY.HRPlatform.Performance.Features.Strategic.Commands;
using EY.HRPlatform.Performance.Features.Strategic.Dtos;
using EY.HRPlatform.Performance.Features.Strategic.Queries;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/strategic-objectives")]
[Authorize]
public sealed class StrategicObjectivesController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? periodId,
        [FromQuery] string? orgScope,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetStrategicObjectivesQuery(periodId, orgScope), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<IReadOnlyList<StrategicObjectiveDto>>.Success(result.Value));
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateStrategicObjectiveRequest request,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(new CreateStrategicObjectiveCommand(
            request.PeriodId, request.OrgScope, request.Title, request.Description), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : CreatedAtAction(nameof(GetAll), ApiResponse<Guid>.Success(result.Value));
    }

    [HttpPost("{id:guid}/publish")]
    public async Task<IActionResult> Publish(
        Guid id,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!TryParseVersion(ifMatch, out var version))
            return StatusCode(StatusCodes.Status428PreconditionRequired,
                ApiResponse.Failure("If-Match header with the current version is required."));

        var result = await sender.Send(new PublishStrategicObjectiveCommand(id, version), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : NoContent();
    }

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase))
            return NotFound(ApiResponse.Failure(error.Message));
        if (error.Code.Contains("Forbidden", StringComparison.OrdinalIgnoreCase))
            return Forbid();
        if (error.Code.Contains("Validation", StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse.Failure(error.Message));
        return Conflict(ApiResponse.Failure(error.Message));
    }

    private static bool TryParseVersion(string? ifMatch, out uint version)
    {
        version = 0;
        if (string.IsNullOrWhiteSpace(ifMatch))
            return false;

        var trimmed = ifMatch.Trim().Trim('"');
        if (trimmed.StartsWith("W/", StringComparison.OrdinalIgnoreCase))
            trimmed = trimmed[2..].Trim('"');

        return uint.TryParse(trimmed, out version);
    }
}
