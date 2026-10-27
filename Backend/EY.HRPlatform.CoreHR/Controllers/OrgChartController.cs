using System.Security.Claims;
using EY.HRPlatform.CoreHR.Features.OrgChart;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/org-chart")]
[Authorize]
public sealed class OrgChartController(
    ISender sender,
    ICoreAccessPolicyService accessPolicy) : ControllerBase
{
    /// <summary>
    /// The people org chart as of a date (today by default), shaped for the caller: Tenant scope sees everyone,
    /// DirectReports scope sees its own chain and branch with the rest folded into counts. Another date than today
    /// is for HR only, since future moves and exits are confidential.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<OrgChartDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Get([FromQuery] DateOnly? asOf, CancellationToken cancellationToken)
    {
        var scope = accessPolicy.GetOrgChartScope(User);
        if (scope is null) return Forbid();

        var hr = accessPolicy.CanViewTenantEmployees(User);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (asOf is { } date && date != today && !hr) return Forbid();

        var result = await sender.Send(
            new OrgChartQuery(asOf ?? today, scope == PermissionScopes.Tenant ? OrgChartScopes.Tenant : OrgChartScopes.DirectReports, User.GetEmployeeId(), hr),
            cancellationToken);
        return Ok(ApiResponse<OrgChartDto>.Success(result.Value));
    }

    /// <summary>
    /// Joins, leavers and manager moves dated within a window of up to two years, both days included: the upcoming
    /// cards and badges on HR's time bar. HR only, like any date other than today.
    /// </summary>
    [HttpGet("changes")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<OrgChartChangeDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetChanges([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken cancellationToken)
    {
        if (accessPolicy.GetOrgChartScope(User) is null || !accessPolicy.CanViewTenantEmployees(User)) return Forbid();
        if (from is not { } start || to is not { } end || end < start || end.DayNumber - start.DayNumber > MaxChangeWindowDays)
            return BadRequest(ApiResponse.Failure("Give a window that ends on or after its start and spans two years at most."));

        var result = await sender.Send(new OrgChartChangesQuery(start, end), cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<OrgChartChangeDto>>.Success(result.Value));
    }

    /// <summary>Adds an open role under a manager: a dashed Hiring card in their line. People admins only.</summary>
    [HttpPost("open-roles")]
    [ProducesResponseType(typeof(ApiResponse<OrgChartOpenRoleDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateOpenRole([FromBody] OpenRoleRequest request, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageEmployees(User)) return Forbid();

        var result = await sender.Send(new CreateOpenRoleCommand(request, AuditActor()), cancellationToken);
        return result.IsFailure
            ? OpenRoleFailure(result.Error)
            : StatusCode(StatusCodes.Status201Created, ApiResponse<OrgChartOpenRoleDto>.Success(result.Value));
    }

    /// <summary>Edits an open role: title, manager, unit, target start and status (Filled or Closed take it off the chart).</summary>
    [HttpPut("open-roles/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<OrgChartOpenRoleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateOpenRole(Guid id, [FromBody] OpenRoleRequest request, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageEmployees(User)) return Forbid();

        var result = await sender.Send(new UpdateOpenRoleCommand(id, request, AuditActor()), cancellationToken);
        return result.IsFailure ? OpenRoleFailure(result.Error) : Ok(ApiResponse<OrgChartOpenRoleDto>.Success(result.Value));
    }

    private IActionResult OpenRoleFailure(EY.HRPlatform.SharedKernel.Results.Error error)
        => error.Code == OpenRoleErrors.NotFoundCode
            ? NotFound(ApiResponse.Failure(error.Message))
            : BadRequest(ApiResponse.Failure(error.Message));

    private string AuditActor()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        var name = User.FindFirstValue(CustomClaimTypes.FullName) ?? User.FindFirstValue(ClaimTypes.Email) ?? "Unknown user";
        return $"{id}|{name}";
    }

    private const int MaxChangeWindowDays = 731;
}
