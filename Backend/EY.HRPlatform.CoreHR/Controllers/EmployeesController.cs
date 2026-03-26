using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.CreateEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.DeactivateEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeById;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployees;
using EY.HRPlatform.CoreHR.Models.Requests;
using EY.HRPlatform.SharedKernel.Api;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/employees")]
[Authorize]
public class EmployeesController(ISender sender) : ControllerBase
{
    /// <summary>
    /// List employees with optional search, filtering, sorting, and pagination.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResponse<EmployeeListItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? department,
        [FromQuery] EmployeeStatus? status,
        [FromQuery] EmployeeSortField sortBy = EmployeeSortField.Name,
        [FromQuery] SortDirection sortDir = SortDirection.Asc,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = new GetEmployeesQuery(search, department, status, sortBy, sortDir, page, pageSize);
        var result = await sender.Send(query, cancellationToken);
        return Ok(ApiResponse<PagedResponse<EmployeeListItemDto>>.Success(result.Value));
    }

    /// <summary>
    /// Create a new employee within the current tenant.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status201Created)]
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
            request.Department,
            request.JobTitle,
            request.ManagerId);

        var result = await sender.Send(command, cancellationToken);

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return CreatedAtAction(
            nameof(GetById),
            new { id = result.Value.Id },
            ApiResponse<EmployeeDto>.Success(result.Value));
    }

    /// <summary>
    /// Get an employee by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetEmployeeByIdQuery(id), cancellationToken);

        if (result.IsFailure)
        {
            return NotFound(ApiResponse.Failure(result.Error.Message));
        }

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponse<EmployeeDto>.Success(result.Value));
    }

    /// <summary>
    /// Update an existing employee's details.
    /// Requires If-Match header with current version for optimistic concurrency.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status200OK)]
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
            request.Department,
            request.JobTitle,
            request.ManagerId);

        var result = await sender.Send(command, cancellationToken);

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponse<EmployeeDto>.Success(result.Value));
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
}
