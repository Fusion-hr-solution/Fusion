using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Commands;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Authorize]
public class ObjectiveTemplatesController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : ControllerBase
{
    // ── Template library endpoints ─────────────────────────────────────

    [HttpGet("api/performance/template-library")]
    public async Task<IActionResult> GetTemplateLibrary(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] Guid? categoryId,
        [FromQuery] string? measurementType,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanViewObjectiveLibrary(User))
            return Forbid();

        var result = await sender.Send(
            new GetTemplateLibraryQuery(search, status, categoryId, measurementType, page, pageSize),
            cancellationToken);
        if (result.IsFailure)
            return MapFailure(result.Error);

        return Ok(ApiResponse<Models.Responses.PagedResponse<TemplateDto>>.Success(result.Value));
    }

    [HttpGet("api/performance/template-library/{id:guid}")]
    public async Task<IActionResult> GetTemplate(Guid id, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewObjectiveLibrary(User))
            return Forbid();

        var result = await sender.Send(new GetTemplateQuery(id), cancellationToken);
        if (result.IsFailure)
            return MapFailure(result.Error);

        if (result.Value.DraftRevision is { } draft)
            SetETag(draft.Version);
        return Ok(ApiResponse<TemplateDto>.Success(result.Value));
    }

    [HttpGet("api/performance/template-library/{id:guid}/history")]
    public async Task<IActionResult> GetTemplateRevisionHistory(Guid id, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewObjectiveLibrary(User))
            return Forbid();

        var result = await sender.Send(new GetTemplateRevisionHistoryQuery(id), cancellationToken);
        if (result.IsFailure)
            return MapFailure(result.Error);

        return Ok(ApiResponse<IReadOnlyList<TemplateRevisionHistoryEntryDto>>.Success(result.Value));
    }

    [HttpPost("api/performance/template-library")]
    public async Task<IActionResult> CreateTemplate(
        [FromBody] CreateTemplateDraftRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectiveLibrary(User))
            return Forbid();

        var result = await sender.Send(new CreateTemplateDraftCommand(User, request), cancellationToken);
        if (result.IsFailure)
            return MapFailure(result.Error);

        if (result.Value.DraftRevision is { } draft)
            SetETag(draft.Version);
        return Ok(ApiResponse<TemplateDto>.Success(result.Value));
    }

    [HttpPut("api/performance/template-library/{id:guid}/draft")]
    public async Task<IActionResult> UpdateDraft(
        Guid id,
        [FromBody] UpdateTemplateDraftRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectiveLibrary(User))
            return Forbid();

        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var req = request with { ExpectedVersion = expectedVersion };
        var result = await sender.Send(new UpdateTemplateDraftCommand(id, User, req), cancellationToken);
        if (result.IsFailure)
            return MapFailure(result.Error);

        if (result.Value.DraftRevision is { } draft)
            SetETag(draft.Version);
        return Ok(ApiResponse<TemplateDto>.Success(result.Value));
    }

    [HttpPost("api/performance/template-library/{id:guid}/draft/activate")]
    public async Task<IActionResult> ActivateRevision(
        Guid id,
        [FromBody] ActivateTemplateRevisionRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectiveLibrary(User))
            return Forbid();

        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var req = request with { ExpectedVersion = expectedVersion };
        var result = await sender.Send(new ActivateTemplateRevisionCommand(id, User, req), cancellationToken);
        if (result.IsFailure)
            return MapFailure(result.Error);

        if (result.Value.ActiveRevision is { } active)
            SetETag(active.Version);
        return Ok(ApiResponse<TemplateDto>.Success(result.Value));
    }

    [HttpPost("api/performance/template-library/{id:guid}/revise")]
    public async Task<IActionResult> StartNewRevision(
        Guid id,
        [FromBody] CreateTemplateDraftRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectiveLibrary(User))
            return Forbid();

        var result = await sender.Send(new EditActiveViaNewRevisionCommand(id, User, request), cancellationToken);
        if (result.IsFailure)
            return MapFailure(result.Error);

        if (result.Value.DraftRevision is { } draft)
            SetETag(draft.Version);
        return Ok(ApiResponse<TemplateDto>.Success(result.Value));
    }

    [HttpGet("api/performance/template-library/applicability-options")]
    public async Task<IActionResult> GetApplicabilityOptions(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewObjectiveLibrary(User))
            return Forbid();

        var result = await sender.Send(new GetApplicabilityOptionsQuery(), cancellationToken);
        if (result.IsFailure)
            return MapFailure(result.Error);

        return Ok(ApiResponse<ApplicabilityOptionsDto>.Success(result.Value));
    }

    [HttpPost("api/performance/template-library/{id:guid}/duplicate")]
    public async Task<IActionResult> Duplicate(Guid id, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectiveLibrary(User))
            return Forbid();

        var result = await sender.Send(new DuplicateTemplateCommand(id, User), cancellationToken);
        if (result.IsFailure)
            return MapFailure(result.Error);

        if (result.Value.DraftRevision is { } draft)
            SetETag(draft.Version);
        return Ok(ApiResponse<TemplateDto>.Success(result.Value));
    }

    [HttpPost("api/performance/template-library/{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectiveLibrary(User))
            return Forbid();

        var result = await sender.Send(new ArchiveTemplateCommand(id, User), cancellationToken);
        if (result.IsFailure)
            return MapFailure(result.Error);

        return Ok(ApiResponse<TemplateDto>.Success(result.Value));
    }

    [HttpPost("api/performance/template-library/{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectiveLibrary(User))
            return Forbid();

        var result = await sender.Send(new RestoreTemplateCommand(id, User), cancellationToken);
        if (result.IsFailure)
            return MapFailure(result.Error);

        return Ok(ApiResponse<TemplateDto>.Success(result.Value));
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private void SetETag(uint version) => Response.Headers.ETag = $"\"{version}\"";

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase))
            return NotFound(ApiResponse.Failure(error.Message));

        if (error.Code.Contains("Validation", StringComparison.OrdinalIgnoreCase))
            return UnprocessableEntity(ApiResponse.Failure(error.Message));

        return Conflict(ApiResponse.Failure(error.Message));
    }

    private IActionResult PreconditionRequired()
        => StatusCode(StatusCodes.Status428PreconditionRequired,
            ApiResponse.Failure("If-Match header with the current version is required."));

    private static bool TryParseVersion(string? ifMatch, out uint version)
    {
        version = 0;
        if (string.IsNullOrWhiteSpace(ifMatch))
            return false;

        var trimmed = ifMatch.Trim().Trim('"');
        if (trimmed.StartsWith("W/", StringComparison.OrdinalIgnoreCase))
            trimmed = trimmed[2..].Trim('"');

        return uint.TryParse(trimmed, out version);
    }
}
