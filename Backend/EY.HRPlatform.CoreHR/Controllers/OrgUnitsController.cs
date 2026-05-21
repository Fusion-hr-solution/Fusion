using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployees;
using EY.HRPlatform.CoreHR.Features.OrgUnits.Commands.CreateOrgUnit;
using EY.HRPlatform.CoreHR.Features.OrgUnits.Commands.DeleteOrgUnit;
using EY.HRPlatform.CoreHR.Features.OrgUnits.Commands.UpdateOrgUnit;
using EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;
using EY.HRPlatform.CoreHR.Features.OrgUnits.Queries.GetOrgUnitById;
using EY.HRPlatform.CoreHR.Features.OrgUnits.Queries.GetOrgUnits;
using EY.HRPlatform.CoreHR.Features.OrgUnits.Queries.GetOrgUnitTree;
using EY.HRPlatform.CoreHR.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ApiResponse = EY.HRPlatform.SharedKernel.Api.ApiResponse;
using ApiResponseOfOrgUnitDto = EY.HRPlatform.SharedKernel.Api.ApiResponse<EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos.OrgUnitDto>;
using ApiResponseOfPagedOrgUnitList = EY.HRPlatform.SharedKernel.Api.ApiResponse<EY.HRPlatform.CoreHR.Models.Responses.PagedResponse<EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos.OrgUnitListItemDto>>;
using ApiResponseOfOrgUnitTree = EY.HRPlatform.SharedKernel.Api.ApiResponse<System.Collections.Generic.List<EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos.OrgUnitTreeNodeDto>>;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/org-units")]
[Authorize(Roles = PlatformRole.HRAdmin)]
public class OrgUnitsController(ISender sender) : ControllerBase
{
    /// <summary>
    /// List org units with optional search, filtering, sorting, and pagination.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponseOfPagedOrgUnitList), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? type,
        [FromQuery] Guid? parentId,
        [FromQuery] bool? isActive = true,
        [FromQuery] OrgUnitSortField sortBy = OrgUnitSortField.Name,
        [FromQuery] SortDirection sortDir = SortDirection.Asc,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = new GetOrgUnitsQuery(search, type, parentId, isActive, sortBy, sortDir, page, pageSize);
        var result = await sender.Send(query, cancellationToken);
        return Ok(ApiResponseOfPagedOrgUnitList.Success(result.Value));
    }

    /// <summary>
    /// Get org units as a hierarchical tree structure.
    /// </summary>
    [HttpGet("tree")]
    [ProducesResponseType(typeof(ApiResponseOfOrgUnitTree), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTree(
        [FromQuery] Guid? rootId,
        [FromQuery] int maxDepth = 10,
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        var query = new GetOrgUnitTreeQuery(rootId, maxDepth, includeInactive);
        var result = await sender.Send(query, cancellationToken);
        return Ok(ApiResponseOfOrgUnitTree.Success(result.Value));
    }

    /// <summary>
    /// Get an org unit by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponseOfOrgUnitDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetOrgUnitByIdQuery(id), cancellationToken);

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponseOfOrgUnitDto.Success(result.Value));
    }

    /// <summary>
    /// Create a new org unit within the current tenant.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponseOfOrgUnitDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateOrgUnitRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateOrgUnitCommand(
            request.Code,
            request.Name,
            request.Type,
            request.ParentId);

        var result = await sender.Send(command, cancellationToken);

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return CreatedAtAction(
            nameof(GetById),
            new { id = result.Value.Id },
            ApiResponseOfOrgUnitDto.Success(result.Value));
    }

    /// <summary>
    /// Update an existing org unit.
    /// Requires If-Match header with current version for optimistic concurrency.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponseOfOrgUnitDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status412PreconditionFailed)]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateOrgUnitRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return StatusCode(
                StatusCodes.Status412PreconditionFailed,
                ApiResponse.Failure("If-Match header with valid version is required for updates."));
        }

        var command = new UpdateOrgUnitCommand(
            id,
            request.Name,
            request.Type,
            request.ParentId,
            expectedVersion);

        var result = await sender.Send(command, cancellationToken);

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponseOfOrgUnitDto.Success(result.Value));
    }

    /// <summary>
    /// Deactivate an org unit (soft delete).
    /// Requires If-Match header with current version for optimistic concurrency.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status412PreconditionFailed)]
    public async Task<IActionResult> Delete(
        Guid id,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return StatusCode(
                StatusCodes.Status412PreconditionFailed,
                ApiResponse.Failure("If-Match header with valid version is required for deletion."));
        }

        await sender.Send(new DeleteOrgUnitCommand(id, expectedVersion), cancellationToken);

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
