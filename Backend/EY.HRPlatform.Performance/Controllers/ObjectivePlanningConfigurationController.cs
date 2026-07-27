using EY.HRPlatform.Performance.Features.ObjectivePolicy.Commands;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Dtos;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Queries;
using EY.HRPlatform.Performance.Features.ConfigurationAudit.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/objective-planning/configuration")]
[Authorize]
public class ObjectivePlanningConfigurationController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : PerformanceControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewObjectivePlanningConfiguration(User))
            return Denied();

        var result = await sender.Send(new GetObjectivePlanningConfigurationQuery(), cancellationToken);
        return result.IsSuccess
            ? Ok(ApiResponse<ObjectivePlanningConfigurationSummaryDto>.Success(result.Value))
            : MapFailure(result.Error);
    }

    /// <summary>
    /// The configuration change history, most-recent-first. Platform-scoped entries are included
    /// only for a platform administrator.
    /// </summary>
    [HttpGet("audit")]
    public async Task<IActionResult> GetAudit(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewObjectivePlanningConfiguration(User))
            return Denied();

        var result = await sender.Send(
            new GetConfigurationAuditQuery(
                IncludePlatformScope: accessPolicy.CanManagePlatformDefaults(User),
                page,
                pageSize),
            cancellationToken);

        return result.IsSuccess
            ? Ok(ApiResponse<PagedResponse<ConfigurationAuditEntryDto>>.Success(result.Value))
            : MapFailure(result.Error);
    }

    [HttpPost("apply")]
    public async Task<IActionResult> Apply(
        [FromBody] ApplyObjectivePlanningConfigurationRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectivePlanningConfiguration(User))
            return Denied();

        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return MissingPrecondition();

        var result = await sender.Send(
            new ApplyObjectivePlanningConfigurationCommand(User, request, expectedVersion),
            cancellationToken);

        if (result.IsFailure)
            return MapFailure(result.Error);

        if (result.Value is { Applied: true, Configuration: { } configuration })
            Response.Headers.ETag = $"\"{configuration.Version}\"";

        return Ok(ApiResponse<ObjectivePlanningConfigurationApplyResultDto>.Success(result.Value));
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
