using EY.HRPlatform.CoreHR.Features.OrganizationImport;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Authorize]
[Route("api/corehr/organization/imports")]
public sealed class OrganizationImportController(
    IOrganizationImportService importService,
    IOrganizationImportWorkbookService workbookService,
    ICoreAccessPolicyService accessPolicy,
    IOrganizationImportSemanticAssistanceService? semanticAssistance = null) : ControllerBase
{
    private const long MultipartLimit = 11L * 1024 * 1024;
    private const long SemanticRequestLimit = 64L * 1024;

    [HttpGet("template")]
    public async Task<IActionResult> DownloadTemplate(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOrganization(User)) return Forbid();
        var workbook = await workbookService.CreateTemplateAsync(cancellationToken);
        return File(workbook.Bytes, XlsxContentType, workbook.FileName);
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] DateOnly asOf, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOrganization(User)) return Forbid();
        try
        {
            var workbook = await workbookService.CreateExportAsync(asOf, cancellationToken);
            return File(workbook.Bytes, XlsxContentType, workbook.FileName);
        }
        catch (OrganizationImportSourceException exception)
        {
            return SourceProblem(exception);
        }
    }

    [HttpPost("intake")]
    [RequestSizeLimit(MultipartLimit)]
    [RequestFormLimits(MultipartBodyLengthLimit = MultipartLimit)]
    public async Task<IActionResult> Intake(
        [FromForm] IFormFile file,
        [FromForm] DateOnly effectiveDate,
        [FromForm] Guid creationToken,
        [FromForm] string? selectedSheetName,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOrganization(User)) return Forbid();
        if (file is null) return BadRequest(ApiResponse.Failure("Choose a source file."));
        try
        {
            await using var stream = file.OpenReadStream();
            var result = await importService.IntakeAsync(
                stream,
                file.FileName,
                file.ContentType,
                effectiveDate,
                creationToken,
                selectedSheetName,
                Actor(),
                cancellationToken);
            if (result.Session is not null) SetEtag(result.Session.Version);
            if (result.Kind == OrganizationImportIntakeKind.SourceReady && !result.Replayed)
                return StatusCode(StatusCodes.Status201Created, ApiResponse<OrganizationImportIntakeResult>.Success(result));
            return Ok(ApiResponse<OrganizationImportIntakeResult>.Success(result));
        }
        catch (OrganizationImportSourceException exception)
        {
            return SourceProblem(exception);
        }
    }

    [HttpGet("active")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<OrganizationImportActiveSummaryDto>>>> GetActive(
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOrganization(User)) return Forbid();
        return Ok(ApiResponse<IReadOnlyList<OrganizationImportActiveSummaryDto>>.Success(
            await importService.GetActiveAsync(cancellationToken)));
    }

    [HttpGet("{sessionId:guid}")]
    public async Task<ActionResult<ApiResponse<OrganizationImportSessionDto>>> Get(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOrganization(User)) return Forbid();
        var session = await importService.GetAsync(sessionId, cancellationToken);
        SetEtag(session.Version);
        return Ok(ApiResponse<OrganizationImportSessionDto>.Success(session));
    }

    [HttpPatch("{sessionId:guid}/effective-date")]
    public async Task<ActionResult<ApiResponse<OrganizationImportSessionDto>>> ChangeEffectiveDate(
        Guid sessionId,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        [FromBody] UpdateOrganizationImportEffectiveDateRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOrganization(User)) return Forbid();
        if (!TryParseVersion(ifMatch, out var version))
            return BadRequest(ApiResponse.Failure("A current import version is required."));
        var session = await importService.ChangeEffectiveDateAsync(
            sessionId, version, request.EffectiveDate, Actor(), cancellationToken);
        SetEtag(session.Version);
        return Ok(ApiResponse<OrganizationImportSessionDto>.Success(session));
    }

    [HttpPost("{sessionId:guid}/discard")]
    public async Task<ActionResult<ApiResponse<OrganizationImportSessionDto>>> Discard(
        Guid sessionId,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOrganization(User)) return Forbid();
        if (!TryParseVersion(ifMatch, out var version))
            return BadRequest(ApiResponse.Failure("A current import version is required."));
        var session = await importService.DiscardAsync(sessionId, version, Actor(), cancellationToken);
        SetEtag(session.Version);
        return Ok(ApiResponse<OrganizationImportSessionDto>.Success(session));
    }

    [HttpPut("{sessionId:guid}/decisions")]
    public async Task<ActionResult<ApiResponse<OrganizationImportSessionDto>>> ReplaceDecisions(
        Guid sessionId,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        [FromBody] ReplaceOrganizationImportDecisionsRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOrganization(User)) return Forbid();
        if (!TryParseVersion(ifMatch, out var version))
            return BadRequest(ApiResponse.Failure("A current import version is required."));
        try
        {
            var session = await importService.ReplaceDecisionsAsync(sessionId, version, request.Decisions, Actor(), cancellationToken);
            SetEtag(session.Version);
            return Ok(ApiResponse<OrganizationImportSessionDto>.Success(session));
        }
        catch (OrganizationImportReviewException exception) { return ReviewProblem(exception); }
    }

    [HttpPost("{sessionId:guid}/refresh")]
    public async Task<ActionResult<ApiResponse<OrganizationImportSessionDto>>> Refresh(Guid sessionId, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOrganization(User)) return Forbid();
        try
        {
            var session = await importService.RefreshAsync(sessionId, cancellationToken);
            SetEtag(session.Version);
            return Ok(ApiResponse<OrganizationImportSessionDto>.Success(session));
        }
        catch (OrganizationImportReviewException exception) { return ReviewProblem(exception); }
    }

    [HttpPost("{sessionId:guid}/semantic-suggestions")]
    [RequestSizeLimit(SemanticRequestLimit)]
    public async Task<ActionResult<ApiResponse<OrganizationImportSemanticAssistanceDto>>> GenerateSemanticSuggestions(
        Guid sessionId,
        [FromBody] GenerateOrganizationImportSemanticSuggestionsRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOrganization(User)) return Forbid();
        if (semanticAssistance is null) return StatusCode(StatusCodes.Status503ServiceUnavailable, ApiResponse.Failure("Suggestions are unavailable."));
        try
        {
            var result = await semanticAssistance.GenerateAsync(sessionId, request, cancellationToken);
            return Ok(ApiResponse<OrganizationImportSemanticAssistanceDto>.Success(result));
        }
        catch (OrganizationImportReviewException exception) { return ReviewProblem(exception); }
    }

    [HttpPut("{sessionId:guid}/semantic-suggestions/{attemptId:guid}/apply")]
    [RequestSizeLimit(SemanticRequestLimit)]
    public async Task<ActionResult<ApiResponse<OrganizationImportSessionDto>>> ApplySemanticSuggestions(
        Guid sessionId,
        Guid attemptId,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        [FromBody] ApplyOrganizationImportSemanticSuggestionsRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOrganization(User)) return Forbid();
        if (!TryParseVersion(ifMatch, out var version))
            return BadRequest(ApiResponse.Failure("A current import version is required."));
        if (semanticAssistance is null) return StatusCode(StatusCodes.Status503ServiceUnavailable, ApiResponse.Failure("Suggestions are unavailable."));
        try
        {
            await semanticAssistance.ApplyAsync(sessionId, attemptId, version, request, Actor(), cancellationToken);
            var session = await importService.GetAsync(sessionId, cancellationToken);
            SetEtag(session.Version);
            return Ok(ApiResponse<OrganizationImportSessionDto>.Success(session));
        }
        catch (OrganizationImportReviewException exception) { return ReviewProblem(exception); }
    }

    [HttpPost("{sessionId:guid}/commit")]
    public async Task<ActionResult<ApiResponse<OrganizationImportCommitResult>>> Commit(
        Guid sessionId,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        [FromBody] CommitOrganizationImportRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOrganization(User)) return Forbid();
        if (!TryParseVersion(ifMatch, out var version))
            return BadRequest(ApiResponse.Failure("A current import version is required."));
        try
        {
            var result = await importService.CommitAsync(sessionId, version, request.SemanticDigest, Actor(), cancellationToken);
            return Ok(ApiResponse<OrganizationImportCommitResult>.Success(result));
        }
        catch (OrganizationImportReviewException exception) { return ReviewProblem(exception); }
    }

    private OrganizationImportActor Actor() => new(User.GetUserId(), User.GetFullName());

    private ObjectResult SourceProblem(OrganizationImportSourceException exception)
    {
        var problem = new ProblemDetails
        {
            Status = exception.StatusCode,
            Title = "Organization source could not be accepted",
            Detail = exception.Message,
            Type = $"https://fusion.local/problems/organization-import/{exception.Code}",
        };
        problem.Extensions["code"] = exception.Code;
        return StatusCode(exception.StatusCode, problem);
    }

    private ObjectResult ReviewProblem(OrganizationImportReviewException exception)
    {
        var problem = new ProblemDetails
        {
            Status = exception.StatusCode,
            Title = "Organization proposal needs attention",
            Detail = exception.Message,
            Type = $"https://fusion.local/problems/organization-import/{exception.Code}",
        };
        problem.Extensions["code"] = exception.Code;
        return StatusCode(exception.StatusCode, problem);
    }

    private void SetEtag(uint version) => Response.Headers.ETag = $"\"{version}\"";

    private static bool TryParseVersion(string? value, out uint version)
        => uint.TryParse(value?.Trim().Trim('"'), out version);

    private const string XlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}
