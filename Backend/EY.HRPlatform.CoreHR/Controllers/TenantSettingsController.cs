using EY.HRPlatform.CoreHR.Features.TenantSettings.Commands.UpdateTenantSettings;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Queries.GetTenantSettings;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/settings")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class TenantSettingsController(ISender sender) : ControllerBase
{
    /// <summary>
    /// Get tenant settings for the current tenant.
    /// Returns merged platform defaults with tenant-specific overrides.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<TenantSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var settings = await sender.Send(new GetTenantSettingsQuery(), cancellationToken);

        if (settings.Version.HasValue)
            Response.Headers.ETag = $"\"{settings.Version}\"";

        return Ok(ApiResponse<TenantSettingsDto>.Success(settings));
    }

    /// <summary>
    /// Partial update of tenant settings.
    /// Creates settings if none exist (If-Match optional for creation).
    /// Updates existing settings (If-Match required, returns 409 if missing or mismatched).
    /// </summary>
    [HttpPatch]
    [ProducesResponseType(typeof(ApiResponse<TenantSettingsDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Patch(
        [FromBody] UpdateTenantSettingsRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        // Parse If-Match header (optional for creation, required for updates)
        uint? expectedVersion = TryParseVersion(ifMatch, out var version) ? version : null;

        var command = new UpdateTenantSettingsCommand(
            expectedVersion,
            request.OrgUnitTypes,
            request.EmployeeFieldConfig,
            request.Branding);

        var result = await sender.Send(command, cancellationToken);

        if (result.Value.Version.HasValue)
            Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponse<TenantSettingsDto>.Success(result.Value));
    }

    private static bool TryParseVersion(string? ifMatch, out uint version)
    {
        version = 0;

        if (string.IsNullOrWhiteSpace(ifMatch))
            return false;

        // Remove surrounding quotes if present: "123" -> 123
        var trimmed = ifMatch.Trim().Trim('"');

        return uint.TryParse(trimmed, out version);
    }
}
