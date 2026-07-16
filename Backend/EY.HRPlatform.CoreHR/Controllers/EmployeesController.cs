using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.ChangeEmployeeManager;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.CreateEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.RehireEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.TerminateEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateOwnEmployeeProfile;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeByKey;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeById;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeOrgChart;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployees;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeReportingLines;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeReportingLinesByKey;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetWorkforceReadinessSummary;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.CoreHR.Models.Requests;
using EY.HRPlatform.CoreHR.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using ApiResponse = EY.HRPlatform.SharedKernel.Api.ApiResponse;
using ApiResponseOfEmployeeDetailsDto = EY.HRPlatform.SharedKernel.Api.ApiResponse<EY.HRPlatform.CoreHR.Features.Employees.Dtos.EmployeeDetailsDto>;
using ApiResponseOfEmployeeOrgChartDto = EY.HRPlatform.SharedKernel.Api.ApiResponse<EY.HRPlatform.CoreHR.Features.Employees.Dtos.EmployeeOrgChartDto>;
using ApiResponseOfPagedEmployeeList = EY.HRPlatform.SharedKernel.Api.ApiResponse<EY.HRPlatform.CoreHR.Models.Responses.PagedResponse<EY.HRPlatform.CoreHR.Features.Employees.Dtos.EmployeeListItemDto>>;
using ApiResponseOfEmployeeReportingLinesDto = EY.HRPlatform.SharedKernel.Api.ApiResponse<EY.HRPlatform.CoreHR.Features.Employees.Dtos.EmployeeReportingLinesDto>;
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
        [FromQuery] string? orgUnitCode,
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

        var query = new GetEmployeesQuery(search, status, access, readiness, orgUnitId, orgUnitCode, managerId, sortBy, sortDir, page, pageSize);
        var result = await sender.Send(query, cancellationToken);

        if (result.IsFailure)
        {
            return NotFound(ApiResponse.Failure(result.Error.Message));
        }

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
        [FromQuery] string? rootEmployeeKey,
        [FromQuery] string? focusEmployeeKey,
        [FromQuery] Guid? orgUnitId,
        [FromQuery] string? orgUnitCode,
        [FromQuery] int maxDepth = 10,
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanViewOrgChart(User))
        {
            return Forbid();
        }

        var result = await sender.Send(
            new GetEmployeeOrgChartQuery(rootEmployeeId, focusEmployeeId, rootEmployeeKey, focusEmployeeKey, orgUnitId, orgUnitCode, maxDepth, includeInactive),
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
    [ProducesResponseType(typeof(ApiResponseOfEmployeeDetailsDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
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
        if (result.IsFailure)
        {
            return MapEmployeeMutationFailure(result.Error);
        }

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return CreatedAtAction(
            nameof(GetById),
            new { id = result.Value.Id },
            ApiResponseOfEmployeeDetailsDto.Success(result.Value));
    }

    /// <summary>
    /// Get an employee by stable public key (visible URLs use this).
    /// </summary>
    [HttpGet("by-key/{employeeKey}")]
    [ProducesResponseType(typeof(ApiResponseOfEmployeeDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByKey(string employeeKey, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewTenantEmployees(User))
        {
            return Forbid();
        }

        var result = await sender.Send(new GetEmployeeByKeyQuery(employeeKey), cancellationToken);

        if (result.IsFailure)
        {
            return NotFound(ApiResponse.Failure(result.Error.Message));
        }

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponseOfEmployeeDetailsDto.Success(result.Value));
    }

    /// <summary>
    /// Get an employee by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponseOfEmployeeDetailsDto), StatusCodes.Status200OK)]
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

        return Ok(ApiResponseOfEmployeeDetailsDto.Success(result.Value));
    }

    /// <summary>
    /// Get reporting-line summary by stable employee key (visible URLs use this).
    /// </summary>
    [HttpGet("by-key/{employeeKey}/reporting-lines")]
    [ProducesResponseType(typeof(ApiResponseOfEmployeeReportingLinesDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetReportingLinesByKey(string employeeKey, CancellationToken cancellationToken)
    {
        if (accessPolicy.GetEmployeeViewScope(User) is null && !accessPolicy.CanViewOwnProfile(User))
        {
            return Forbid();
        }

        var audience = GetCurrentReadAudience();
        var result = await sender.Send(new GetEmployeeReportingLinesByKeyQuery(employeeKey, audience), cancellationToken);

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
    [ProducesResponseType(typeof(ApiResponseOfEmployeeDetailsDto), StatusCodes.Status200OK)]
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
        if (!CanUpdateEmployee(request))
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
            request.PreferredName,
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
        if (result.IsFailure)
        {
            return MapEmployeeMutationFailure(result.Error);
        }

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponseOfEmployeeDetailsDto.Success(result.Value));
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
    /// Terminate an employee's active canonical employment chain.
    /// Requires If-Match header with current version for optimistic concurrency.
    /// </summary>
    [HttpPost("{id:guid}/terminate")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status412PreconditionFailed)]
    public async Task<IActionResult> Terminate(
        Guid id,
        [FromBody] TerminateEmployeeRequest request,
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
                ApiResponse.Failure("If-Match header with valid version is required for termination."));
        }

        var result = await sender.Send(
            new TerminateEmployeeCommand(id, expectedVersion, request.EffectiveDate, request.Note),
            cancellationToken);
        if (result.IsFailure)
        {
            return MapEmployeeMutationFailure(result.Error);
        }

        return NoContent();
    }

    /// <summary>
    /// Rehire a previously employed worker: creates a new employment, primary work assignment, and
    /// optional manager relationship without reopening prior employment.
    /// Requires If-Match header with current version for optimistic concurrency.
    /// </summary>
    [HttpPost("{id:guid}/rehire")]
    [ProducesResponseType(typeof(ApiResponseOfEmployeeDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status412PreconditionFailed)]
    public async Task<IActionResult> Rehire(
        Guid id,
        [FromBody] RehireEmployeeRequest request,
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
                ApiResponse.Failure("If-Match header with valid version is required for rehire."));
        }

        var result = await sender.Send(
            new RehireEmployeeCommand(
                id,
                expectedVersion,
                request.EffectiveDate,
                request.OrgUnitId,
                request.JobTitle,
                request.WorkLocation,
                request.ManagerId,
                request.EmploymentType),
            cancellationToken);
        if (result.IsFailure)
        {
            return MapEmployeeMutationFailure(result.Error);
        }

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponseOfEmployeeDetailsDto.Success(result.Value));
    }

    /// <summary>
    /// Change an employee's primary manager effective a given date. Atomically ends the current
    /// primary manager relationship and creates the new one.
    /// Requires If-Match header with current version for optimistic concurrency.
    /// </summary>
    [HttpPost("{id:guid}/change-manager")]
    [ProducesResponseType(typeof(ApiResponseOfEmployeeDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status412PreconditionFailed)]
    public async Task<IActionResult> ChangeManager(
        Guid id,
        [FromBody] ChangeEmployeeManagerRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageEmployees(User) && !accessPolicy.CanManageReporting(User))
        {
            return Forbid();
        }

        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return StatusCode(
                StatusCodes.Status412PreconditionFailed,
                ApiResponse.Failure("If-Match header with valid version is required for a manager change."));
        }

        var result = await sender.Send(
            new ChangeEmployeeManagerCommand(id, expectedVersion, request.ManagerId, request.EffectiveDate),
            cancellationToken);
        if (result.IsFailure)
        {
            return MapEmployeeMutationFailure(result.Error);
        }

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponseOfEmployeeDetailsDto.Success(result.Value));
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

    private bool CanUpdateEmployee(UpdateEmployeeRequest request)
        => accessPolicy.CanManageEmployees(User)
            || (accessPolicy.CanManageReporting(User) && IsReportingOnlyUpdate(request));

    // Reporting-only users can reuse the employee update endpoint when the request
    // only changes manager relationships.
    private static bool IsReportingOnlyUpdate(UpdateEmployeeRequest request)
        => request.ManagerId.HasValue
            && request.EmployeeNumber is null
            && request.FirstName is null
            && request.LastName is null
            && request.PreferredName is null
            && request.Email is null
            && request.Phone is null
            && request.JobTitle is null
            && request.WorkLocation is null
            && request.EmploymentType is null
            && request.OrgUnitId is null
            && request.HireDate is null;

    private EmployeeReadAudience GetCurrentReadAudience()
        => accessPolicy.GetEmployeeReadAudience(User);

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

    private IActionResult MapEmployeeMutationFailure(EY.HRPlatform.SharedKernel.Results.Error error)
    {
        if (error.Code.EndsWith(".NotFound", StringComparison.Ordinal))
        {
            return NotFound(ApiResponse.Failure(error.Message));
        }

        if (error.Code.Contains("Duplicate", StringComparison.OrdinalIgnoreCase)
            || error.Code.Contains("Conflict", StringComparison.OrdinalIgnoreCase)
            || error.Code.Contains("AlreadyActive", StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(ApiResponse.Failure(error.Message));
        }

        return BadRequest(ApiResponse.Failure(error.Message));
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
