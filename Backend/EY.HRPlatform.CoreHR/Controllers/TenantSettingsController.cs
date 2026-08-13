using EY.HRPlatform.CoreHR.Features.TenantSettings.Commands.UpdateTenantSettings;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Queries.GetTenantSettings;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/settings")]
[Authorize]
public class TenantSettingsController(
    ISender sender,
    ICoreAccessPolicyService accessPolicy,
    ISettingsSectionRegistry sectionRegistry,
    ISettingsAuditService auditService) : ControllerBase
{
    [HttpGet("sections")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<SettingsSectionDto>>), StatusCodes.Status200OK)]
    public ActionResult<ApiResponse<IReadOnlyList<SettingsSectionDto>>> GetSections()
    {
        var sections = sectionRegistry.GetVisibleSections(User);
        return Ok(ApiResponse<IReadOnlyList<SettingsSectionDto>>.Success(sections));
    }

    [HttpGet("overview")]
    [ProducesResponseType(typeof(ApiResponse<SettingsOverviewDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<SettingsOverviewDto>>> GetOverview(CancellationToken cancellationToken)
    {
        var sections = sectionRegistry.GetVisibleSections(User);
        if (sections.Count == 0)
        {
            return Forbid();
        }

        IReadOnlyList<SettingsAuditEventDto> auditEvents = accessPolicy.CanViewGovernanceSettings(User)
            ? await auditService.GetRecentAsync(5, cancellationToken)
            : [];

        var overview = new SettingsOverviewDto(
            sections,
            BuildHealth(sections),
            auditEvents);

        return Ok(ApiResponse<SettingsOverviewDto>.Success(overview));
    }

    /// <summary>
    /// Get tenant settings for the current tenant.
    /// Returns merged platform defaults with tenant-specific overrides.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<TenantSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewSettings(User))
        {
            return Forbid();
        }

        var settings = await sender.Send(new GetTenantSettingsQuery(), cancellationToken);

        if (settings.Version.HasValue)
            Response.Headers.ETag = $"\"{settings.Version}\"";

        return Ok(ApiResponse<TenantSettingsDto>.Success(settings));
    }

    [HttpGet("organization")]
    [ProducesResponseType(typeof(ApiResponse<OrganizationSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOrganization(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewOrganizationSettings(User))
        {
            return Forbid();
        }

        var settings = await GetSettingsAsync(cancellationToken);
        SetEtag(settings.Version);
        return Ok(ApiResponse<OrganizationSettingsDto>.Success(MapOrganization(settings)));
    }

    [HttpPatch("organization")]
    [ProducesResponseType(typeof(ApiResponse<OrganizationSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> PatchOrganization(
        [FromBody] UpdateOrganizationSettingsRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOrganizationSettings(User))
        {
            return Forbid();
        }

        var before = await GetSettingsAsync(cancellationToken);
        var updated = await UpdateSettingsAsync(
            ifMatch,
            new UpdateTenantSettingsRequest(null, request.Branding, null, null),
            cancellationToken);

        await auditService.RecordAsync(
            SettingsSectionIds.Organization,
            "settings.organization.updated",
            "TenantSettings",
            null,
            "Organization settings updated.",
            MapOrganization(before),
            MapOrganization(updated),
            User,
            cancellationToken);

        SetEtag(updated.Version);
        return Ok(ApiResponse<OrganizationSettingsDto>.Success(MapOrganization(updated)));
    }

    [HttpGet("people-data")]
    [ProducesResponseType(typeof(ApiResponse<PeopleDataSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPeopleData(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewPeopleDataSettings(User))
        {
            return Forbid();
        }

        var settings = await GetSettingsAsync(cancellationToken);
        SetEtag(settings.Version);
        return Ok(ApiResponse<PeopleDataSettingsDto>.Success(MapPeopleData(settings)));
    }

    [HttpPatch("people-data")]
    [ProducesResponseType(typeof(ApiResponse<PeopleDataSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> PatchPeopleData(
        [FromBody] UpdatePeopleDataSettingsRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManagePeopleDataSettings(User))
        {
            return Forbid();
        }

        var before = await GetSettingsAsync(cancellationToken);
        var updated = await UpdateSettingsAsync(
            ifMatch,
            new UpdateTenantSettingsRequest(request.EmployeeFieldConfig, null, request.SelfService, null),
            cancellationToken);

        await auditService.RecordAsync(
            SettingsSectionIds.PeopleData,
            "settings.peopleData.updated",
            "TenantSettings",
            null,
            "People data settings updated.",
            MapPeopleData(before),
            MapPeopleData(updated),
            User,
            cancellationToken);

        SetEtag(updated.Version);
        return Ok(ApiResponse<PeopleDataSettingsDto>.Success(MapPeopleData(updated)));
    }

    [HttpGet("provisioning")]
    [ProducesResponseType(typeof(ApiResponse<ProvisioningSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProvisioning(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewProvisioningSettings(User))
        {
            return Forbid();
        }

        var settings = await GetSettingsAsync(cancellationToken);
        SetEtag(settings.Version);
        return Ok(ApiResponse<ProvisioningSettingsDto>.Success(MapProvisioning(settings)));
    }

    [HttpPatch("provisioning")]
    [ProducesResponseType(typeof(ApiResponse<ProvisioningSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> PatchProvisioning(
        [FromBody] UpdateProvisioningSettingsRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageProvisioningSettings(User))
        {
            return Forbid();
        }

        var before = await GetSettingsAsync(cancellationToken);
        var updated = await UpdateSettingsAsync(
            ifMatch,
            new UpdateTenantSettingsRequest(null, null, null, request.Provisioning),
            cancellationToken);

        await auditService.RecordAsync(
            SettingsSectionIds.Provisioning,
            "settings.provisioning.updated",
            "TenantSettings",
            null,
            "Provisioning settings updated.",
            MapProvisioning(before),
            MapProvisioning(updated),
            User,
            cancellationToken);

        SetEtag(updated.Version);
        return Ok(ApiResponse<ProvisioningSettingsDto>.Success(MapProvisioning(updated)));
    }

    [HttpGet("governance/audit")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<SettingsAuditEventDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAudit([FromQuery] int take = 50, CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanViewGovernanceSettings(User))
        {
            return Forbid();
        }

        var auditEvents = await auditService.GetRecentAsync(take, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<SettingsAuditEventDto>>.Success(auditEvents));
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
        if (!accessPolicy.CanManageSettings(User))
        {
            return Forbid();
        }

        // Parse If-Match header (optional for creation, required for updates)
        uint? expectedVersion = TryParseVersion(ifMatch, out var version) ? version : null;

        var command = new UpdateTenantSettingsCommand(
            expectedVersion,
            request.EmployeeFieldConfig,
            request.Branding,
            request.SelfService,
            request.Provisioning);

        var before = await sender.Send(new GetTenantSettingsQuery(), cancellationToken);
        var result = await sender.Send(command, cancellationToken);

        if (result.Value.Version.HasValue)
            Response.Headers.ETag = $"\"{result.Value.Version}\"";

        foreach (var sectionId in ResolveMutatedSections(request))
        {
            await auditService.RecordAsync(
                sectionId,
                $"settings.{sectionId}.updated",
                "TenantSettings",
                null,
                $"{sectionId} settings updated.",
                before,
                result.Value,
                User,
                cancellationToken);
        }

        return Ok(ApiResponse<TenantSettingsDto>.Success(result.Value));
    }

    private async Task<TenantSettingsDto> GetSettingsAsync(CancellationToken cancellationToken)
        => await sender.Send(new GetTenantSettingsQuery(), cancellationToken);

    private async Task<TenantSettingsDto> UpdateSettingsAsync(
        string? ifMatch,
        UpdateTenantSettingsRequest request,
        CancellationToken cancellationToken)
    {
        uint? expectedVersion = TryParseVersion(ifMatch, out var version) ? version : null;
        var result = await sender.Send(new UpdateTenantSettingsCommand(
            expectedVersion,
            request.EmployeeFieldConfig,
            request.Branding,
            request.SelfService,
            request.Provisioning), cancellationToken);

        return result.Value;
    }

    private static OrganizationSettingsDto MapOrganization(TenantSettingsDto settings)
        => new(
            settings.Version,
            "Current organization",
            "en-US",
            "UTC",
            settings.Branding,
            settings.Branding.LogoUrl is null && settings.Branding.PrimaryColor == TenantSettingsDto.Defaults.Branding.PrimaryColor);

    private static PeopleDataSettingsDto MapPeopleData(TenantSettingsDto settings)
        => new(
            settings.Version,
            settings.EmployeeFieldConfig,
            settings.SelfService,
            ["Employee profiles", "Employee import validation", "Self-service profile forms"]);

    private static ProvisioningSettingsDto MapProvisioning(TenantSettingsDto settings)
        => new(
            settings.Version,
            settings.Provisioning,
            ["Access bulk invitations", "Pending invite refresh", "Default profile selection"]);

    private static IReadOnlyList<SettingsHealthItemDto> BuildHealth(IReadOnlyList<SettingsSectionDto> sections)
    {
        var health = new List<SettingsHealthItemDto>();
        if (sections.All(section => section.Id != SettingsSectionIds.Governance))
        {
            health.Add(new SettingsHealthItemDto(
                SettingsSectionIds.Governance,
                "attention",
                "Governance visibility is limited",
                "No audit reader capability is active for this actor."));
        }

        if (sections.Count == 0)
        {
            health.Add(new SettingsHealthItemDto(
                SettingsSectionIds.Overview,
                "blocked",
                "No settings capabilities",
                "This actor cannot administer tenant settings."));
        }

        return health;
    }

    private static IEnumerable<string> ResolveMutatedSections(UpdateTenantSettingsRequest request)
    {
        if (request.Branding is not null)
            yield return SettingsSectionIds.Organization;
        if (request.EmployeeFieldConfig is not null || request.SelfService is not null)
            yield return SettingsSectionIds.PeopleData;
        if (request.Provisioning is not null)
            yield return SettingsSectionIds.Provisioning;
    }

    private void SetEtag(uint? version)
    {
        if (version.HasValue)
            Response.Headers.ETag = $"\"{version}\"";
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

public sealed record UpdateOrganizationSettingsRequest(BrandingSettingsInput? Branding);

public sealed record UpdatePeopleDataSettingsRequest(
    Dictionary<string, FieldConfigInput>? EmployeeFieldConfig,
    SelfServiceSettingsInput? SelfService);


public sealed record UpdateProvisioningSettingsRequest(ProvisioningSettingsInput? Provisioning);
