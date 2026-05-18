using EY.HRPlatform.CoreHR.Features.Workforce.Dtos;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Models.Responses;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/workforce")]
[Authorize]
public class WorkforceController(IWorkforceContractService workforceContractService) : ControllerBase
{
    private const string WorkforceReadRoles = PlatformRole.PlatformAdmin + "," + PlatformRole.HRAdmin + "," + PlatformRole.Employee + "," + PlatformRole.Manager;
    private const string OrgUnitReadRoles = PlatformRole.PlatformAdmin + "," + PlatformRole.HRAdmin;
    [HttpGet("me")]
    [Authorize(Roles = WorkforceReadRoles)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceCurrentUserContextDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCurrentContext(CancellationToken cancellationToken)
    {
        var result = await workforceContractService.GetCurrentUserContextAsync(User, cancellationToken);
        return Ok(ApiResponse<WorkforceCurrentUserContextDto>.Success(result));
    }

    [HttpGet("employees/{employeeId:guid}")]
    [Authorize(Roles = WorkforceReadRoles)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceEmployeeSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetEmployee(Guid employeeId, CancellationToken cancellationToken)
    {
        var result = await workforceContractService.GetEmployeeAsync(employeeId, User, cancellationToken);
        if (result is null)
        {
            return NotFound(ApiResponse.Failure("Employee was not found or is not visible in the current scope."));
        }

        return Ok(ApiResponse<WorkforceEmployeeSummaryDto>.Success(result));
    }

    [HttpPost("employees/resolve")]
    [Authorize(Roles = WorkforceReadRoles)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WorkforceEmployeeSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ResolveEmployees(
        [FromBody] WorkforceEmployeeResolveRequest request,
        CancellationToken cancellationToken)
    {
        var result = await workforceContractService.ResolveEmployeesAsync(request.EmployeeIds, User, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<WorkforceEmployeeSummaryDto>>.Success(result));
    }

    [HttpGet("employees/search")]
    [Authorize(Roles = WorkforceReadRoles)]
    [ProducesResponseType(typeof(ApiResponse<PagedResponse<WorkforceEmployeeSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SearchEmployees(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await workforceContractService.SearchEmployeesAsync(search, page, pageSize, User, cancellationToken);
        return Ok(ApiResponse<PagedResponse<WorkforceEmployeeSummaryDto>>.Success(result));
    }

    [HttpGet("employees/{employeeId:guid}/team")]
    [Authorize(Roles = WorkforceReadRoles)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WorkforceEmployeeSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTeam(Guid employeeId, CancellationToken cancellationToken)
    {
        var result = await workforceContractService.GetTeamAsync(employeeId, User, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<WorkforceEmployeeSummaryDto>>.Success(result));
    }

    [HttpGet("employees/{employeeId:guid}/manager-chain")]
    [Authorize(Roles = WorkforceReadRoles)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WorkforceEmployeeSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetManagerChain(Guid employeeId, CancellationToken cancellationToken)
    {
        var result = await workforceContractService.GetManagerChainAsync(employeeId, User, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<WorkforceEmployeeSummaryDto>>.Success(result));
    }

    [HttpGet("org-units")]
    [Authorize(Roles = OrgUnitReadRoles)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WorkforceOrgUnitSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPublishedOrgUnits(
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        var result = await workforceContractService.GetPublishedOrgUnitsAsync(includeInactive, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<WorkforceOrgUnitSummaryDto>>.Success(result));
    }

    [HttpGet("org-units/tree")]
    [Authorize(Roles = OrgUnitReadRoles)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceOrgUnitTreeDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPublishedOrgUnitTree(
        [FromQuery] Guid? rootId,
        [FromQuery] int maxDepth = 10,
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        var result = await workforceContractService.GetPublishedOrgUnitTreeAsync(rootId, maxDepth, includeInactive, cancellationToken);
        return Ok(ApiResponse<WorkforceOrgUnitTreeDto>.Success(result));
    }
}
