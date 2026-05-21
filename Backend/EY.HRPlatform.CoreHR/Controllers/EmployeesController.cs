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
public class EmployeesController(ISender sender) : ControllerBase
{
    private const string LinkedEmployeeReadRoles = PlatformRole.PlatformAdmin + "," + PlatformRole.HRAdmin + "," + PlatformRole.Employee + "," + PlatformRole.Manager;

    /// <summary>
    /// List employees with optional search, status filtering, sorting, and pagination.
    /// </summary>
    [HttpGet]
    [Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
    [ProducesResponseType(typeof(ApiResponseOfPagedEmployeeList), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] EmployeeStatus? status,
        [FromQuery] EmployeeAccessFilter? access,
        [FromQuery] EmployeeReadinessFilter? readiness,
        [FromQuery] EmployeeSortField sortBy = EmployeeSortField.Name,
        [FromQuery] SortDirection sortDir = SortDirection.Asc,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = new GetEmployeesQuery(search, status, access, readiness, sortBy, sortDir, page, pageSize);
        var result = await sender.Send(query, cancellationToken);
        return Ok(ApiResponseOfPagedEmployeeList.Success(result.Value));
    }

    [HttpGet("readiness-summary")]
    [Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
    [ProducesResponseType(typeof(ApiResponseOfWorkforceReadinessSummaryDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetReadinessSummary(CancellationToken cancellationToken = default)
    {
        var result = await sender.Send(new GetWorkforceReadinessSummaryQuery(), cancellationToken);
        return Ok(ApiResponseOfWorkforceReadinessSummaryDto.Success(result.Value));
    }

    /// <summary>
    /// Get a hierarchy tree for org chart rendering.
    /// Supports focus-employee root resolution, org unit scoping, and inactive visibility.
    /// </summary>
    [HttpGet("org-chart")]
    [Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
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
    [Authorize(Roles = PlatformRole.HRAdmin)]
    [ProducesResponseType(typeof(ApiResponseOfEmployeeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateEmployeeRequest request,
        CancellationToken cancellationToken)
    {
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
    [Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
    [ProducesResponseType(typeof(ApiResponseOfEmployeeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
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
    [Authorize(Roles = LinkedEmployeeReadRoles)]
    [ProducesResponseType(typeof(ApiResponseOfEmployeeProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetProfile(Guid id, CancellationToken cancellationToken)
    {
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
    [Authorize(Roles = LinkedEmployeeReadRoles)]
    [ProducesResponseType(typeof(ApiResponseOfEmployeeReportingLinesDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetReportingLines(Guid id, CancellationToken cancellationToken)
    {
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
    [Authorize(Roles = PlatformRole.HRAdmin)]
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
    [Authorize(Roles = LinkedEmployeeReadRoles)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status412PreconditionFailed)]
    public async Task<IActionResult> UpdateSelfProfile(
        Guid id,
        [FromBody] UpdateOwnEmployeeProfileRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!CanUpdateOwnProfile(id))
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
    [Authorize(Roles = PlatformRole.HRAdmin)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status412PreconditionFailed)]
    public async Task<IActionResult> Deactivate(
        Guid id,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
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
    {
        if (User.IsInRole(PlatformRole.HRAdmin) || User.IsInRole(PlatformRole.PlatformAdmin))
        {
            return EmployeeReadAudience.HrAdmin;
        }

        return User.IsInRole(PlatformRole.Manager)
            ? EmployeeReadAudience.Manager
            : EmployeeReadAudience.Employee;
    }

    private bool CanReadProfile(EmployeeProfileDto profile)
    {
        if (User.IsInRole(PlatformRole.HRAdmin) || User.IsInRole(PlatformRole.PlatformAdmin))
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
            return true;
        }

        return User.IsInRole(PlatformRole.Manager) && profile.ManagerId == linkedEmployeeId.Value;
    }

    private bool CanReadReportingLines(EmployeeListItemDto employee)
    {
        if (User.IsInRole(PlatformRole.HRAdmin) || User.IsInRole(PlatformRole.PlatformAdmin))
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
            return true;
        }

        return User.IsInRole(PlatformRole.Manager) && employee.ManagerId == linkedEmployeeId.Value;
    }

    private bool CanUpdateOwnProfile(Guid employeeId)
    {
        var linkedEmployeeId = User.GetEmployeeId();
        return linkedEmployeeId.HasValue && linkedEmployeeId.Value == employeeId;
    }

    private EmployeeReportingLinesDto ApplyReportingScope(EmployeeReportingLinesDto reportingLines)
    {
        if (User.IsInRole(PlatformRole.HRAdmin) || User.IsInRole(PlatformRole.PlatformAdmin))
        {
            return reportingLines;
        }

        if (User.IsInRole(PlatformRole.Manager))
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
