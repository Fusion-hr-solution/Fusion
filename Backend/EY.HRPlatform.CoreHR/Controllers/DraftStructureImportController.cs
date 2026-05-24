using EY.HRPlatform.CoreHR.Features.DraftStructure.Import.Dtos;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Services;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/setup/draft-structure/import")]
[Authorize]
public class DraftStructureImportController(
    IDraftStructureImportWorkflowService workflowService,
    ICoreAccessPolicyService accessPolicy) : ControllerBase
{
    [HttpGet("schema")]
    [ProducesResponseType(typeof(ApiResponse<DraftStructureImportSchemaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSchema(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageStructure(User))
        {
            return Forbid();
        }

        var schema = await workflowService.GetSchemaAsync(cancellationToken);
        return Ok(ApiResponse<DraftStructureImportSchemaDto>.Success(schema));
    }

    [HttpGet("template")]
    public async Task<IActionResult> DownloadTemplate(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageStructure(User))
        {
            return Forbid();
        }

        var template = await workflowService.BuildTemplateAsync(cancellationToken);
        return File(template.Content, "text/csv", template.FileName);
    }

    [HttpPost]
    [RequestSizeLimit(10 * 1024 * 1024)]
    [ProducesResponseType(typeof(ApiResponse<DraftStructureImportSessionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Upload(
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageStructure(User))
        {
            return Forbid();
        }

        var session = await workflowService.UploadAsync(
            file,
            cancellationToken,
            new DraftStructureActivityActor(
                User.GetUserId(),
                User.GetFullName(),
                GetActorRole(),
                User.IsInRole(PlatformRole.PlatformAdmin)));
        return Ok(ApiResponse<DraftStructureImportSessionDto>.Success(session));
    }

    [HttpGet("{sessionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<DraftStructureImportSessionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSession(Guid sessionId, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageStructure(User))
        {
            return Forbid();
        }

        var session = await workflowService.GetSessionAsync(sessionId, cancellationToken);
        return Ok(ApiResponse<DraftStructureImportSessionDto>.Success(session));
    }

    [HttpPut("{sessionId:guid}/mapping")]
    [ProducesResponseType(typeof(ApiResponse<DraftStructureImportSessionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SaveMapping(
        Guid sessionId,
        [FromBody] DraftStructureImportMappingRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageStructure(User))
        {
            return Forbid();
        }

        var session = await workflowService.SaveMappingAsync(sessionId, request, cancellationToken);
        return Ok(ApiResponse<DraftStructureImportSessionDto>.Success(session));
    }

    [HttpPut("{sessionId:guid}/kinds")]
    [ProducesResponseType(typeof(ApiResponse<DraftStructureImportSessionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ResolveKinds(
        Guid sessionId,
        [FromBody] DraftStructureImportResolveKindsRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageStructure(User))
        {
            return Forbid();
        }

        var session = await workflowService.ResolveKindsAsync(sessionId, request, cancellationToken);
        return Ok(ApiResponse<DraftStructureImportSessionDto>.Success(session));
    }

    [HttpPost("{sessionId:guid}/validate")]
    [ProducesResponseType(typeof(ApiResponse<DraftStructureImportSessionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Validate(Guid sessionId, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageStructure(User))
        {
            return Forbid();
        }

        var session = await workflowService.ValidateAsync(sessionId, cancellationToken);
        return Ok(ApiResponse<DraftStructureImportSessionDto>.Success(session));
    }

    [HttpPost("{sessionId:guid}/apply")]
    [ProducesResponseType(typeof(ApiResponse<DraftStructureImportApplyResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Apply(Guid sessionId, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageStructure(User))
        {
            return Forbid();
        }

        var result = await workflowService.ApplyAsync(
            sessionId,
            cancellationToken,
            new DraftStructureActivityActor(
                User.GetUserId(),
                User.GetFullName(),
                GetActorRole(),
                User.IsInRole(PlatformRole.PlatformAdmin)));
        return Ok(ApiResponse<DraftStructureImportApplyResultDto>.Success(result));
    }

    private string GetActorRole()
        => User.IsInRole(PlatformRole.PlatformAdmin)
            ? PlatformRole.PlatformAdmin
            : PlatformRole.HRAdmin;
}
