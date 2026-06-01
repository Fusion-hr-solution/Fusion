using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.CreateEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.DeactivateEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateOwnEmployeeProfile;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeById;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeOrgChart;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployees;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeReportingLines;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeProfile;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetWorkforceReadinessSummary;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.CoreHR.Models.Requests;
using EY.HRPlatform.CoreHR.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using ApiResponse = EY.HRPlatform.SharedKernel.Api.ApiResponse;
using ApiResponseOfEmployeeDto = EY.HRPlatform.SharedKernel.Api.ApiResponse<EY.HRPlatform.CoreHR.Features.Employees.Dtos.EmployeeDto>;
using ApiResponseOfEmployeeOrgChartDto = EY.HRPlatform.SharedKernel.Api.ApiResponse<EY.HRPlatform.CoreHR.Features.Employees.Dtos.EmployeeOrgChartDto>;
using ApiResponseOfPagedEmployeeList = EY.HRPlatform.SharedKernel.Api.ApiResponse<EY.HRPlatform.CoreHR.Models.Responses.PagedResponse<EY.HRPlatform.CoreHR.Features.Employees.Dtos.EmployeeListItemDto>>;
using ApiResponseOfEmployeeReportingLinesDto = EY.HRPlatform.SharedKernel.Api.ApiResponse<EY.HRPlatform.CoreHR.Features.Employees.Dtos.EmployeeReportingLinesDto>;
using ApiResponseOfEmployeeProfileDto = EY.HRPlatform.SharedKernel.Api.ApiResponse<EY.HRPlatform.CoreHR.Features.Employees.Dtos.EmployeeProfileDto>;
using ApiResponseOfWorkforceReadinessSummaryDto = EY.HRPlatform.SharedKernel.Api.ApiResponse<EY.HRPlatform.CoreHR.Features.Employees.Dtos.WorkforceReadinessSummaryDto>;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/employees")]
[Authorize]
public class EmployeesController(
    ISender sender,
    ICoreAccessPolicyService accessPolicy) : ControllerBase
{
    /// <summary>
    /// List employees with optional search, status filtering, sorting, and pagination.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponseOfPagedEmployeeList), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] EmployeeStatus? status,
        [FromQuery] EmployeeAccessFilter? access,
        [FromQuery] EmployeeReadinessFilter? readiness,
        [FromQuery] Guid? orgUnitId,
        [FromQuery] Guid? managerId,
        [FromQuery] EmployeeSortField sortBy = EmployeeSortField.Name,
        [FromQuery] SortDirection sortDir = SortDirection.Asc,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanViewTenantEmployees(User))
        {
            return Forbid();
        }

        var query = new GetEmployeesQuery(search, status, access, readiness, orgUnitId, managerId, sortBy, sortDir, page, pageSize);
        var result = await sender.Send(query, cancellationToken);
        return Ok(ApiResponseOfPagedEmployeeList.Success(result.Value));
    }

    [HttpGet("readiness-summary")]
    [ProducesResponseType(typeof(ApiResponseOfWorkforceReadinessSummaryDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetReadinessSummary(CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanViewTenantEmployees(User))
        {
            return Forbid();
        }

        var result = await sender.Send(new GetWorkforceReadinessSummaryQuery(), cancellationToken);
        return Ok(ApiResponseOfWorkforceReadinessSummaryDto.Success(result.Value));
    }

    /// <summary>
    /// Get a hierarchy tree for org chart rendering.
    /// Supports focus-employee root resolution, org unit scoping, and inactive visibility.
    /// </summary>
    [HttpGet("org-chart")]
    [ProducesResponseType(typeof(ApiResponseOfEmployeeOrgChartDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetOrgChart(
        [FromQuery] Guid? rootEmployeeId,
        [FromQuery] Guid? focusEmployeeId,
        [FromQuery] Guid? orgUnitId,
        [FromQuery] int maxDepth = 10,
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanViewOrgChart(User))
        {
            return Forbid();
        }

        var result = await sender.Send(
            new GetEmployeeOrgChartQuery(rootEmployeeId, focusEmployeeId, orgUnitId, maxDepth, includeInactive),
            cancellationToken);

        if (result.IsFailure)
        {
            return NotFound(ApiResponse.Failure(result.Error.Message));
        }

        return Ok(ApiResponseOfEmployeeOrgChartDto.Success(result.Value));
    }

    /// <summary>
    /// Create a new employee within the current tenant.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponseOfEmployeeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateEmployeeRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageEmployees(User))
        {
            return Forbid();
        }

        var command = new CreateEmployeeCommand(
            request.FirstName,
            request.LastName,
            request.Email,
            request.HireDate,
            request.JobTitle,
            request.ManagerId,
            request.OrgUnitId,
            request.EmployeeNumber,
            request.Phone,
            request.WorkLocation,
            request.EmploymentType);

        var result = await sender.Send(command, cancellationToken);

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return CreatedAtAction(
            nameof(GetById),
            new { id = result.Value.Id },
            ApiResponseOfEmployeeDto.Success(result.Value));
    }

    /// <summary>
    /// Get an employee by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponseOfEmployeeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewTenantEmployees(User))
        {
            return Forbid();
        }

        var result = await sender.Send(new GetEmployeeByIdQuery(id), cancellationToken);

        if (result.IsFailure)
        {
            return NotFound(ApiResponse.Failure(result.Error.Message));
        }

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponseOfEmployeeDto.Success(result.Value));
    }

    /// <summary>
    /// Get the profile read model for an employee, combining identity, employment, org context,
    /// direct-report count, and hierarchy status in a single response.
    /// </summary>
    [HttpGet("{id:guid}/profile")]
    [ProducesResponseType(typeof(ApiResponseOfEmployeeProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetProfile(Guid id, CancellationToken cancellationToken)
    {
        if (accessPolicy.GetEmployeeViewScope(User) is null && !accessPolicy.CanViewOwnProfile(User))
        {
            return Forbid();
        }

        var audience = GetCurrentReadAudience();
        var result = await sender.Send(new GetEmployeeProfileQuery(id, audience), cancellationToken);

        if (result.IsFailure)
        {
            return NotFound(ApiResponse.Failure(result.Error.Message));
        }

        if (!CanReadProfile(result.Value))
        {
            return Forbid();
        }

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponseOfEmployeeProfileDto.Success(result.Value));
    }

    /// <summary>
    /// Get reporting-line summary for an employee, including manager chain, direct reports, and flat downline.
    /// </summary>
    [HttpGet("{id:guid}/reporting-lines")]
    [ProducesResponseType(typeof(ApiResponseOfEmployeeReportingLinesDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetReportingLines(Guid id, CancellationToken cancellationToken)
    {
        if (accessPolicy.GetEmployeeViewScope(User) is null && !accessPolicy.CanViewOwnProfile(User))
        {
            return Forbid();
        }

        var audience = GetCurrentReadAudience();
        var result = await sender.Send(new GetEmployeeReportingLinesQuery(id, audience), cancellationToken);

        if (result.IsFailure)
        {
            return NotFound(ApiResponse.Failure(result.Error.Message));
        }

        if (!CanReadReportingLines(result.Value.Employee))
        {
            return Forbid();
        }

        return Ok(ApiResponseOfEmployeeReportingLinesDto.Success(ApplyReportingScope(result.Value)));
    }

    /// <summary>
    /// Update an existing employee's details.
    /// Requires If-Match header with current version for optimistic concurrency.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponseOfEmployeeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status412PreconditionFailed)]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateEmployeeRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageEmployees(User))
        {
            return Forbid();
        }

        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return StatusCode(
                StatusCodes.Status412PreconditionFailed,
                ApiResponse.Failure("If-Match header with valid version is required for updates."));
        }

        var command = new UpdateEmployeeCommand(
            id,
            expectedVersion,
            request.FirstName,
            request.LastName,
            request.Email,
            request.JobTitle,
            request.ManagerId,
            request.OrgUnitId,
            request.HireDate,
            request.EmployeeNumber,
            request.Phone,
            request.WorkLocation,
            request.EmploymentType);

        var result = await sender.Send(command, cancellationToken);

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponseOfEmployeeDto.Success(result.Value));
    }

    [HttpPut("{id:guid}/self-profile")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status412PreconditionFailed)]
    public async Task<IActionResult> UpdateSelfProfile(
        Guid id,
        [FromBody] UpdateOwnEmployeeProfileRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanUpdateOwnProfile(User) || !CanUpdateOwnProfile(id))
        {
            return Forbid();
        }

        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return StatusCode(
                StatusCodes.Status412PreconditionFailed,
                ApiResponse.Failure("If-Match header with valid version is required for updates."));
        }

        await sender.Send(
            new UpdateOwnEmployeeProfileCommand(id, expectedVersion, request.PreferredName, request.Phone),
            cancellationToken);

        return NoContent();
    }

    /// <summary>
    /// Deactivate an employee (soft delete).
    /// Requires If-Match header with current version for optimistic concurrency.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status412PreconditionFailed)]
    public async Task<IActionResult> Deactivate(
        Guid id,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageEmployees(User))
        {
            return Forbid();
        }

        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return StatusCode(
                StatusCodes.Status412PreconditionFailed,
                ApiResponse.Failure("If-Match header with valid version is required for deactivation."));
        }

        await sender.Send(new DeactivateEmployeeCommand(id, expectedVersion), cancellationToken);

        return NoContent();
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

    private EmployeeReadAudience GetCurrentReadAudience()
        => accessPolicy.GetEmployeeReadAudience(User);

    private bool CanReadProfile(EmployeeProfileDto profile)
    {
        var scope = accessPolicy.GetEmployeeViewScope(User);
        if (scope == PermissionScopes.Tenant)
        {
            return true;
        }

        var linkedEmployeeId = User.GetEmployeeId();
        if (!linkedEmployeeId.HasValue)
        {
            return false;
        }

        if (profile.Id == linkedEmployeeId.Value)
        {
            return scope == PermissionScopes.Self || scope == PermissionScopes.DirectReports || accessPolicy.CanViewOwnProfile(User);
        }

        return scope == PermissionScopes.DirectReports && profile.ManagerId == linkedEmployeeId.Value;
    }

    private bool CanReadReportingLines(EmployeeListItemDto employee)
    {
        var scope = accessPolicy.GetEmployeeViewScope(User);
        if (scope == PermissionScopes.Tenant)
        {
            return true;
        }

        var linkedEmployeeId = User.GetEmployeeId();
        if (!linkedEmployeeId.HasValue)
        {
            return false;
        }

        if (employee.Id == linkedEmployeeId.Value)
        {
            return scope == PermissionScopes.Self || scope == PermissionScopes.DirectReports || accessPolicy.CanViewOwnProfile(User);
        }

        return scope == PermissionScopes.DirectReports && employee.ManagerId == linkedEmployeeId.Value;
    }

    private bool CanUpdateOwnProfile(Guid employeeId)
    {
        var linkedEmployeeId = User.GetEmployeeId();
        return linkedEmployeeId.HasValue && linkedEmployeeId.Value == employeeId;
    }

    private EmployeeReportingLinesDto ApplyReportingScope(EmployeeReportingLinesDto reportingLines)
    {
        var scope = accessPolicy.GetEmployeeViewScope(User);
        if (scope == PermissionScopes.Tenant)
        {
            return reportingLines;
        }

        if (scope == PermissionScopes.DirectReports)
        {
            return reportingLines with
            {
                Downline = reportingLines.DirectReports,
                DownlineCount = reportingLines.DirectReports.Count
            };
        }

        return reportingLines with
        {
            DirectReports = Array.Empty<EmployeeHierarchyNodeDto>(),
            Downline = Array.Empty<EmployeeHierarchyNodeDto>(),
            DirectReportCount = 0,
            DownlineCount = 0
        };
    }
}
