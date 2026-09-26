using EY.HRPlatform.CoreHR.Features.Employees.Import;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

/// <summary>
/// Workforce Import product API: Upload (intake), Match (what the source means), Review (the
/// canonical workforce proposal and its bounded resolutions) and Publish (the exact reviewed
/// proposal, atomically). Exposes business meaning only; no persistence, provider or worker terms.
/// </summary>
[ApiController]
[Route("api/corehr/employees/import")]
[Authorize]
public sealed class WorkforceImportController(
    IWorkforceImportSessionService sessions,
    WorkforceImportReviewService review,
    WorkforceImportSemanticAssistanceService semantic,
    WorkforceImportApplyOperationService publication,
    IWorkforceImportTemplateService templateService,
    ICoreAccessPolicyService accessPolicy) : ControllerBase
{
    [HttpGet("template")]
    public IActionResult DownloadTemplate()
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        var template = templateService.Create();
        return File(template.Bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", template.FileName);
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActive(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        var session = await sessions.GetActiveAsync(cancellationToken);
        return Ok(ApiResponse<object?>.Success(session is null ? null : await DescribeAsync(session, includeMatch: false, cancellationToken)));
    }

    [HttpGet("{sessionId:guid}")]
    public async Task<IActionResult> Get(Guid sessionId, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        var session = await sessions.GetAsync(sessionId, cancellationToken);
        if (session is null) return NotFoundResponse();
        // An attempt carried over from an earlier version has no derived proposal yet; derive it once.
        if (session.IsActive && !session.IsPublishing && session.ProposalFingerprint is null && session.Source?.ColumnsJson is not null)
        {
            try { session = await review.RefreshAsync(session.Id, session.Version, cancellationToken); }
            catch (WorkforceImportConcurrencyException) { session = await sessions.GetAsync(sessionId, cancellationToken) ?? session; }
        }
        SetEtag(session.Version);
        return Ok(ApiResponse<object>.Success(await DescribeAsync(session, includeMatch: true, cancellationToken)));
    }

    [HttpPost("intake")]
    [RequestSizeLimit(SafeTabularSourceReader.MaxFileBytes)]
    public async Task<IActionResult> Intake(
        [FromForm] IFormFile file, [FromForm] Guid creationToken, [FromForm] DateOnly baselineDate, [FromForm] string? selectedSheet,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        await using var stream = file.OpenReadStream();
        var outcome = await Guarded(() => sessions.IntakeAsync(
            new WorkforceImportIntakeRequest(creationToken, baselineDate, stream, file.FileName, file.ContentType, selectedSheet, Actor()), cancellationToken));
        if (outcome is IActionResult error) return error;
        var intake = (WorkforceImportIntakeOutcome)outcome!;
        return Ok(ApiResponse<object>.Success(new
        {
            kind = intake.Kind.ToString(),
            replayed = intake.Replayed,
            session = intake.Session is null ? null : await DescribeAsync(intake.Session, includeMatch: false, cancellationToken),
            sheetChoice = intake.SheetChoice,
            headerCandidates = intake.HeaderCandidates,
            conflictReason = intake.ConflictReason,
        }));
    }

    [HttpPut("{sessionId:guid}/header")]
    public Task<IActionResult> SelectHeader(Guid sessionId, [FromHeader(Name = "If-Match")] string? ifMatch, [FromBody] SelectHeaderRequest body, CancellationToken cancellationToken)
        => MutateSession(ifMatch, version => sessions.SelectHeaderRowAsync(sessionId, body.HeaderRowIndex, version, Actor(), cancellationToken), cancellationToken);

    [HttpPut("{sessionId:guid}/baseline")]
    public Task<IActionResult> ChangeBaseline(Guid sessionId, [FromHeader(Name = "If-Match")] string? ifMatch, [FromBody] ChangeBaselineRequest body, CancellationToken cancellationToken)
        => MutateSession(ifMatch, version => review.ChangeBaselineDateAsync(sessionId, version, body.BaselineDate, Actor(), cancellationToken), cancellationToken);

    /// <summary>Match: change what the source means.</summary>
    [HttpPut("{sessionId:guid}/match")]
    public Task<IActionResult> UpdateMatch(Guid sessionId, [FromHeader(Name = "If-Match")] string? ifMatch, [FromBody] WorkforceMatchUpdateRequest body, CancellationToken cancellationToken)
        => MutateSession(ifMatch, version => review.UpdateMatchAsync(sessionId, version, body, Actor(), cancellationToken), cancellationToken);

    [HttpPost("{sessionId:guid}/semantic-assistance/run")]
    [RequestSizeLimit(64 * 1024)]
    public async Task<IActionResult> RunSemanticAssistance(Guid sessionId, [FromBody] RunWorkforceSemanticAssistanceRequest body, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        var result = await Guarded(async () =>
        {
            await semantic.RunAsync(sessionId, body, Actor(), cancellationToken);
            return true;
        });
        if (result is IActionResult error) return error;
        var session = await sessions.GetAsync(sessionId, cancellationToken);
        if (session is null) return NotFoundResponse();
        SetEtag(session.Version);
        return Ok(ApiResponse<object>.Success(await DescribeAsync(session, includeMatch: true, cancellationToken)));
    }

    /// <summary>Re-derive against current CoreHR (for example after the organization changed).</summary>
    [HttpPost("{sessionId:guid}/refresh")]
    public Task<IActionResult> Refresh(Guid sessionId, [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken cancellationToken)
        => MutateSession(ifMatch, version => review.RefreshAsync(sessionId, version, cancellationToken), cancellationToken);

    [HttpGet("{sessionId:guid}/review")]
    public async Task<IActionResult> GetReview(Guid sessionId, [FromQuery] string? filter, [FromQuery] string? query, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        var result = await Guarded(() => review.GetReviewPageAsync(sessionId, filter, query, page, pageSize, cancellationToken));
        if (result is IActionResult error) return error;
        var pageDto = (WorkforceReviewPageDto)result!;
        SetEtag(pageDto.Summary.Version);
        return Ok(ApiResponse<WorkforceReviewPageDto>.Success(pageDto));
    }

    [HttpGet("{sessionId:guid}/manager-candidates")]
    public async Task<IActionResult> GetManagerCandidates(Guid sessionId, [FromQuery] string? reference, [FromQuery] string? query, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        var result = await Guarded(() => review.GetImportManagerCandidatesAsync(sessionId, reference, query, cancellationToken));
        if (result is IActionResult error) return error;
        return Ok(ApiResponse<IReadOnlyList<WorkforceManagerCandidateDto>>.Success((IReadOnlyList<WorkforceManagerCandidateDto>)result!));
    }

    /// <summary>Review: record a bounded resolution for a live issue.</summary>
    [HttpPut("{sessionId:guid}/review/resolutions")]
    public async Task<IActionResult> UpdateResolutions(Guid sessionId, [FromHeader(Name = "If-Match")] string? ifMatch, [FromBody] WorkforceResolutionsUpdateRequest body, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        if (!TryParseVersion(ifMatch, out var version)) return PreconditionRequired();
        var result = await Guarded(() => review.UpdateResolutionsAsync(sessionId, version, body, Actor(), cancellationToken));
        if (result is IActionResult error) return error;
        var summary = (WorkforceReviewSummaryDto)result!;
        SetEtag(summary.Version);
        return Ok(ApiResponse<WorkforceReviewSummaryDto>.Success(summary));
    }

    [HttpPost("{sessionId:guid}/discard")]
    public async Task<IActionResult> Discard(Guid sessionId, [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        if (!TryParseVersion(ifMatch, out var version)) return PreconditionRequired();
        var result = await Guarded(() => sessions.DiscardAsync(sessionId, version, Actor(), cancellationToken));
        return result is IActionResult error ? error : Ok(ApiResponse.Success());
    }

    /// <summary>Publish the exact reviewed proposal. Returns the observable publication status.</summary>
    [HttpPost("{sessionId:guid}/commit")]
    public async Task<IActionResult> Commit(Guid sessionId, [FromHeader(Name = "If-Match")] string? ifMatch, [FromBody] WorkforceCommitRequest body, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        if (!TryParseVersion(ifMatch, out var version)) return PreconditionRequired();
        var result = await Guarded(() => publication.PublishAsync(sessionId, version, body.ProposalFingerprint, Actor(), cancellationToken));
        if (result is IActionResult error) return error;
        return Accepted(ApiResponse<WorkforceImportApplyStatusDto>.Success((WorkforceImportApplyStatusDto)result!));
    }

    [HttpGet("{sessionId:guid}/commit")]
    public async Task<IActionResult> GetCommitStatus(Guid sessionId, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        var status = await publication.GetStatusAsync(sessionId, cancellationToken);
        return status is null ? NotFoundResponse() : Ok(ApiResponse<WorkforceImportApplyStatusDto>.Success(status));
    }

    // ---- helpers ----

    private ImportActor Actor() => new(User.GetUserId(), User.GetFullName());

    private async Task<IActionResult> MutateSession(string? ifMatch, Func<uint, Task<WorkforceImportSession>> mutate, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        if (!TryParseVersion(ifMatch, out var version)) return PreconditionRequired();
        var result = await Guarded(() => mutate(version));
        if (result is IActionResult error) return error;
        var session = (WorkforceImportSession)result!;
        SetEtag(session.Version);
        return Ok(ApiResponse<object>.Success(await DescribeAsync(session, includeMatch: true, cancellationToken)));
    }

    private async Task<object?> Guarded<T>(Func<Task<T>> action)
    {
        try { return await action(); }
        catch (WorkforceImportConcurrencyException) { return Conflict(ApiResponse.Failure("This import changed elsewhere. Refresh to see the latest.")); }
        catch (WorkforceImportNotFoundException) { return NotFoundResponse(); }
        catch (WorkforceImportReviewException ex) { return Problem(ex.Code, ex.Message, StatusFor(ex.Code)); }
        catch (TabularSourceException ex) { return StatusCode(ex.StatusCode, ApiResponse.Failure(ex.Message)); }
    }

    private static int StatusFor(string code) => code switch
    {
        "ProposalChanged" or "NotPublishable" or "ImportTerminal" or "ImportPublishing" or "MatchIncomplete"
            or "SemanticSuggestionsChanged" or "SemanticConsentRequired" or "SemanticSuggestionsRateLimited"
            or "SemanticAssistanceUnavailable" or "SemanticAssistanceNotNeeded" => StatusCodes.Status409Conflict,
        _ => StatusCodes.Status422UnprocessableEntity,
    };

    /// <summary>
    /// The attempt as the product sees it: lifecycle, source, as-of date, where it stands, and the
    /// publication in flight if any. Match detail is included when the caller renders the attempt.
    /// </summary>
    private async Task<object> DescribeAsync(WorkforceImportSession s, bool includeMatch, CancellationToken cancellationToken)
    {
        var status = s.IsActive ? await publication.GetStatusAsync(s.Id, cancellationToken) : null;
        return new
        {
            id = s.Id,
            status = s.Status.ToString(),
            baselineDate = s.BaselineDate,
            version = s.Version,
            updatedAt = s.UpdatedAt ?? s.CreatedAt,
            source = new { fileName = s.Source?.OriginalFileName, format = s.Source?.SourceFormat, rowCount = s.Source?.RowCount, selectedSheet = s.SelectedSheetName },
            counts = new { create = s.CreateCount, existing = s.ExistingCount, notImported = s.NotImportedCount, blocked = s.BlockedCount, withWarnings = s.WarningCount },
            matchComplete = s.MatchComplete,
            canPublish = s.CanPublish,
            proposalFingerprint = s.ProposalFingerprint,
            publication = s.IsPublishing || status is { Status: "Failed" or "ReviewOutdated" } ? status : null,
            commitResult = s.Status == WorkforceImportStatus.Committed ? await publication.GetStatusAsync(s.Id, cancellationToken) : null,
            match = includeMatch && s.IsActive && s.Source?.ColumnsJson is not null ? await review.DescribeMatchAsync(s, cancellationToken) : null,
        };
    }

    /// <summary>Same problem grammar as Organization Import: a stable <c>code</c> the UI branches on.</summary>
    private ObjectResult Problem(string code, string detail, int status)
    {
        var problem = new ProblemDetails
        {
            Status = status,
            Title = "Workforce import needs attention",
            Detail = detail,
            Type = $"https://fusion.local/problems/workforce-import/{code}",
        };
        problem.Extensions["code"] = code;
        return StatusCode(status, problem);
    }

    private IActionResult NotFoundResponse() => NotFound(ApiResponse.Failure("Import was not found."));
    private IActionResult PreconditionRequired() => StatusCode(StatusCodes.Status428PreconditionRequired, ApiResponse.Failure("This action requires the current version (If-Match)."));
    private void SetEtag(uint version) => Response.Headers.ETag = $"\"{version}\"";
    private static bool TryParseVersion(string? value, out uint version) => uint.TryParse(value?.Trim().Trim('"'), out version);
}

public sealed record SelectHeaderRequest(int HeaderRowIndex);
public sealed record ChangeBaselineRequest(DateOnly BaselineDate);
public sealed record WorkforceCommitRequest(string? ProposalFingerprint);
