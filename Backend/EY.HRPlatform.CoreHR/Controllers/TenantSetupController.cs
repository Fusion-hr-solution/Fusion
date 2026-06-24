using EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.ActivateTenantSetup;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.PublishTenantStructure;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.ReopenTenantStructure;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Queries.GetDraftSetupReadiness;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Queries.GetTenantSetupState;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/setup")]
[Authorize]
public class TenantSetupController(
    ISender sender,
    ICoreAccessPolicyService accessPolicy) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<TenantSetupStateDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewSetup(User))
        {
            return Forbid();
        }

        var setupState = await sender.Send(new GetTenantSetupStateQuery(), cancellationToken);

        if (setupState.Version.HasValue)
            Response.Headers.ETag = $"\"{setupState.Version}\"";

        return Ok(ApiResponse<TenantSetupStateDto>.Success(setupState));
    }

    [HttpPost("activate")]
    [ProducesResponseType(typeof(ApiResponse<TenantSetupStateDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Activate(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageSetup(User))
        {
            return Forbid();
        }

        var result = await sender.Send(new ActivateTenantSetupCommand(), cancellationToken);

        if (result.Value.Version.HasValue)
            Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponse<TenantSetupStateDto>.Success(result.Value));
    }

    [HttpGet("readiness")]
    [ProducesResponseType(typeof(ApiResponse<DraftSetupReadinessDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetReadiness(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewSetup(User))
        {
            return Forbid();
        }

        var readiness = await sender.Send(new GetDraftSetupReadinessQuery(), cancellationToken);
        return Ok(ApiResponse<DraftSetupReadinessDto>.Success(readiness));
    }

    [HttpPost("reopen")]
    [ProducesResponseType(typeof(ApiResponse<TenantSetupStateDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status412PreconditionFailed)]
    public async Task<IActionResult> Reopen(
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageSetup(User))
        {
            return Forbid();
        }

        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return StatusCode(
                StatusCodes.Status412PreconditionFailed,
                ApiResponse.Failure("If-Match header with valid version is required for reopen."));
        }

        var result = await sender.Send(
            new ReopenTenantStructureCommand(
                expectedVersion,
                User.GetUserId(),
                User.GetFullName(),
                GetActorRole(),
                User.IsInRole(PlatformRole.PlatformAdmin)),
            cancellationToken);

        if (result.Value.Version.HasValue)
            Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponse<TenantSetupStateDto>.Success(result.Value));
    }

    [HttpPost("publish")]
    [ProducesResponseType(typeof(ApiResponse<TenantSetupStateDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status412PreconditionFailed)]
    public async Task<IActionResult> Publish(
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanPublishStructure(User))
        {
            return Forbid();
        }

        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return StatusCode(
                StatusCodes.Status412PreconditionFailed,
                ApiResponse.Failure("If-Match header with valid version is required for publish."));
        }

        var result = await sender.Send(
            new PublishTenantStructureCommand(
                expectedVersion,
                User.GetUserId(),
                User.GetFullName(),
                GetActorRole(),
                User.IsInRole(PlatformRole.PlatformAdmin)),
            cancellationToken);

        if (result.Value.Version.HasValue)
            Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponse<TenantSetupStateDto>.Success(result.Value));
    }

    private string GetActorRole()
        => User.IsInRole(PlatformRole.PlatformAdmin)
            ? PlatformRole.PlatformAdmin
            : PlatformRole.HRAdmin;

    private static bool TryParseVersion(string? ifMatch, out uint version)
    {
        version = 0;

        if (string.IsNullOrWhiteSpace(ifMatch))
            return false;

        var trimmed = ifMatch.Trim().Trim('"');
        return uint.TryParse(trimmed, out version);
    }
}
