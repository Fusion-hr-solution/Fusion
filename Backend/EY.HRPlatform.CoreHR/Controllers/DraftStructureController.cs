using EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.CreateDraftOrgUnit;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.ClearDraftStructure;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.DeleteDraftOrgUnit;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.UpdateDraftOrgUnit;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Queries.GetDraftOrgUnitById;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Queries.GetDraftOrgUnitTree;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Queries.GetDraftStructureWorkspace;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ApiResponseOfDraftOrgUnitDto = EY.HRPlatform.SharedKernel.Api.ApiResponse<EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos.DraftOrgUnitDto>;
using ApiResponseOfDraftStructureWorkspaceDto = EY.HRPlatform.SharedKernel.Api.ApiResponse<EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos.DraftStructureWorkspaceDto>;
using ApiResponseOfDraftOrgUnitTree = EY.HRPlatform.SharedKernel.Api.ApiResponse<System.Collections.Generic.List<EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos.DraftOrgUnitTreeNodeDto>>;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/setup/draft-structure")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class DraftStructureController(ISender sender) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponseOfDraftStructureWorkspaceDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWorkspace(CancellationToken cancellationToken)
    {
        var workspace = await sender.Send(new GetDraftStructureWorkspaceQuery(), cancellationToken);
        return Ok(ApiResponseOfDraftStructureWorkspaceDto.Success(workspace));
    }

    [HttpGet("tree")]
    [ProducesResponseType(typeof(ApiResponseOfDraftOrgUnitTree), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTree(
        [FromQuery] Guid? rootId,
        [FromQuery] int maxDepth = 10,
        CancellationToken cancellationToken = default)
    {
        var tree = await sender.Send(new GetDraftOrgUnitTreeQuery(rootId, maxDepth), cancellationToken);
        return Ok(ApiResponseOfDraftOrgUnitTree.Success(tree));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponseOfDraftOrgUnitDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var draftOrgUnit = await sender.Send(new GetDraftOrgUnitByIdQuery(id), cancellationToken);

        Response.Headers.ETag = $"\"{draftOrgUnit.Version}\"";

        return Ok(ApiResponseOfDraftOrgUnitDto.Success(draftOrgUnit));
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponseOfDraftOrgUnitDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateDraftOrgUnitRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateDraftOrgUnitCommand(
            request.ReferenceKey,
            request.DisplayName,
            request.OrgUnitKindKey,
            request.Location,
            request.Description,
            request.ParentId,
            request.Attributes,
            User.GetUserId(),
            User.GetFullName(),
            GetActorRole(),
            User.IsInRole(PlatformRole.PlatformAdmin));

        var result = await sender.Send(command, cancellationToken);

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return CreatedAtAction(
            nameof(GetById),
            new { id = result.Value.Id },
            ApiResponseOfDraftOrgUnitDto.Success(result.Value));
    }

    [HttpDelete]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Clear(CancellationToken cancellationToken)
    {
        await sender.Send(
            new ClearDraftStructureCommand(
                User.GetUserId(),
                User.GetFullName(),
                GetActorRole(),
                User.IsInRole(PlatformRole.PlatformAdmin)),
            cancellationToken);
        return NoContent();
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponseOfDraftOrgUnitDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status412PreconditionFailed)]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateDraftOrgUnitRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return StatusCode(
                StatusCodes.Status412PreconditionFailed,
                ApiResponse.Failure("If-Match header with valid version is required for updates."));
        }

        var command = new UpdateDraftOrgUnitCommand(
            id,
            request.ReferenceKey,
            request.DisplayName,
            request.OrgUnitKindKey,
            request.Location,
            request.Description,
            request.ParentId,
            expectedVersion,
            request.Attributes,
            User.GetUserId(),
            User.GetFullName(),
            GetActorRole(),
            User.IsInRole(PlatformRole.PlatformAdmin));

        var result = await sender.Send(command, cancellationToken);

        Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponseOfDraftOrgUnitDto.Success(result.Value));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status412PreconditionFailed)]
    public async Task<IActionResult> Delete(
        Guid id,
        [FromQuery] Guid? replacementParentId,
        [FromQuery] bool promoteChildrenToRoot,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return StatusCode(
                StatusCodes.Status412PreconditionFailed,
                ApiResponse.Failure("If-Match header with valid version is required for deletion."));
        }

        await sender.Send(
            new DeleteDraftOrgUnitCommand(
                id,
                expectedVersion,
                replacementParentId,
                promoteChildrenToRoot,
                User.GetUserId(),
                User.GetFullName(),
                GetActorRole(),
                User.IsInRole(PlatformRole.PlatformAdmin)),
            cancellationToken);

        return NoContent();
    }

    private string GetActorRole()
        => User.IsInRole(PlatformRole.PlatformAdmin)
            ? PlatformRole.PlatformAdmin
            : PlatformRole.HRAdmin;

    private static bool TryParseVersion(string? ifMatch, out uint version)
    {
        version = 0;

        if (string.IsNullOrWhiteSpace(ifMatch))
            return false;

        var trimmed = ifMatch.Trim().Trim('"');
        return uint.TryParse(trimmed, out version);
    }
}
