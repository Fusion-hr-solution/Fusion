using EY.HRPlatform.Performance.Features.PlatformDefaults.Commands;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/platform/configuration")]
[Authorize]
public class ObjectiveDefaultsController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : PerformanceControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManagePlatformDefaults(User))
            return Denied();

        var result = await sender.Send(new GetPlatformPerformanceConfigurationQuery(), cancellationToken);
        return result.IsSuccess
            ? Ok(ApiResponse<PlatformPerformanceConfigurationSummaryDto>.Success(result.Value))
            : MapFailure(result.Error);
    }

    [HttpPost("apply")]
    public async Task<IActionResult> Apply(
        [FromBody] ApplyPlatformPerformanceConfigurationRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManagePlatformDefaults(User))
            return Denied();

        var expectedVersion = TryParseVersion(ifMatch, out var version) ? version : (uint?)null;
        var result = await sender.Send(
            new ApplyPlatformPerformanceConfigurationCommand(User, request, expectedVersion),
            cancellationToken);

        if (result.IsFailure)
            return MapFailure(result.Error);

        if (result.Value.Configuration is { } configuration)
            Response.Headers.ETag = $"\"{configuration.Version}\"";

        return Ok(ApiResponse<PlatformConfigurationApplyResultDto>.Success(result.Value));
    }

    private IActionResult MapFailure(Error error) => Problem(error);

    private static bool TryParseVersion(string? ifMatch, out uint version)
    {
        version = 0;
        if (string.IsNullOrWhiteSpace(ifMatch)) return false;
        var trimmed = ifMatch.Trim().Trim('"');
        if (trimmed.StartsWith("W/", StringComparison.OrdinalIgnoreCase))
            trimmed = trimmed[2..].Trim('"');
        return uint.TryParse(trimmed, out version);
    }
}
