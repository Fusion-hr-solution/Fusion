using EY.HRPlatform.CoreHR.Features.Workforce.Dtos;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Models.Responses;
using EY.HRPlatform.SharedKernel.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/workforce")]
[Authorize]
public class WorkforceController(
    IWorkforceContractService workforceContractService,
    ICoreAccessPolicyService accessPolicy) : ControllerBase
{
    [HttpGet("me")]
    [ProducesResponseType(typeof(ApiResponse<WorkforceCurrentUserContextDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCurrentContext(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewOwnProfile(User)
            && !accessPolicy.CanViewTeam(User)
            && !accessPolicy.CanViewTenantEmployees(User))
        {
            return Forbid();
        }

        var result = await workforceContractService.GetCurrentUserContextAsync(User, cancellationToken);
        return Ok(ApiResponse<WorkforceCurrentUserContextDto>.Success(result));
    }

    [HttpGet("employees/{employeeId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<WorkforceEmployeeSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetEmployee(Guid employeeId, CancellationToken cancellationToken)
    {
        if (accessPolicy.GetEmployeeViewScope(User) is null && !accessPolicy.CanViewOwnProfile(User))
        {
            return Forbid();
        }

        var result = await workforceContractService.GetEmployeeAsync(employeeId, User, cancellationToken);
        if (result is null)
        {
            return NotFound(ApiResponse.Failure("Employee was not found or is not visible in the current scope."));
        }

        return Ok(ApiResponse<WorkforceEmployeeSummaryDto>.Success(result));
    }

    [HttpPost("employees/resolve")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WorkforceEmployeeSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ResolveEmployees(
        [FromBody] WorkforceEmployeeResolveRequest request,
        CancellationToken cancellationToken)
    {
        if (accessPolicy.GetEmployeeViewScope(User) is null && !accessPolicy.CanViewOwnProfile(User))
        {
            return Forbid();
        }

        var result = await workforceContractService.ResolveEmployeesAsync(request.EmployeeIds, User, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<WorkforceEmployeeSummaryDto>>.Success(result));
    }

    [HttpGet("employees/search")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponse<WorkforceEmployeeSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SearchEmployees(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (accessPolicy.GetEmployeeViewScope(User) is null && !accessPolicy.CanViewOwnProfile(User))
        {
            return Forbid();
        }

        var result = await workforceContractService.SearchEmployeesAsync(search, page, pageSize, User, cancellationToken);
        return Ok(ApiResponse<PagedResponse<WorkforceEmployeeSummaryDto>>.Success(result));
    }

    [HttpGet("access-subjects")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponse<WorkforceAccessSubjectSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SearchAccessSubjects(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanViewAccess(User))
        {
            return Forbid();
        }

        var result = await workforceContractService.SearchAccessSubjectsAsync(search, page, pageSize, cancellationToken);
        return Ok(ApiResponse<PagedResponse<WorkforceAccessSubjectSummaryDto>>.Success(result));
    }

    [HttpGet("employees/{employeeId:guid}/team")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WorkforceEmployeeSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTeam(Guid employeeId, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewTeam(User) && !accessPolicy.CanViewTenantEmployees(User))
        {
            return Forbid();
        }

        var result = await workforceContractService.GetTeamAsync(employeeId, User, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<WorkforceEmployeeSummaryDto>>.Success(result));
    }

    [HttpGet("employees/{employeeId:guid}/manager-chain")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WorkforceEmployeeSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetManagerChain(Guid employeeId, CancellationToken cancellationToken)
    {
        if (accessPolicy.GetEmployeeViewScope(User) is null && !accessPolicy.CanViewOwnProfile(User))
        {
            return Forbid();
        }

        var result = await workforceContractService.GetManagerChainAsync(employeeId, User, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<WorkforceEmployeeSummaryDto>>.Success(result));
    }

    [HttpGet("org-units")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WorkforceOrgUnitSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPublishedOrgUnits(
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanViewStructure(User))
        {
            return Forbid();
        }

        var result = await workforceContractService.GetPublishedOrgUnitsAsync(includeInactive, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<WorkforceOrgUnitSummaryDto>>.Success(result));
    }

    [HttpGet("org-units/tree")]
    [ProducesResponseType(typeof(ApiResponse<WorkforceOrgUnitTreeDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPublishedOrgUnitTree(
        [FromQuery] Guid? rootId,
        [FromQuery] int maxDepth = 10,
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanViewStructure(User))
        {
            return Forbid();
        }

        var result = await workforceContractService.GetPublishedOrgUnitTreeAsync(rootId, maxDepth, includeInactive, cancellationToken);
        return Ok(ApiResponse<WorkforceOrgUnitTreeDto>.Success(result));
    }
}
