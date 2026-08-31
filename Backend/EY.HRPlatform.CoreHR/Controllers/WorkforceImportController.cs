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
/// Canonical Workforce Import product API. Exposes business meaning only — no persistence, EF,
/// provider/model, or queue/worker terminology. Backed by the create-only establishment pipeline.
/// </summary>
[ApiController]
[Route("api/corehr/employees/import")]
[Authorize]
public sealed class WorkforceImportController(
    IWorkforceImportSessionService sessions,
    WorkforceImportReviewService review,
    WorkforceImportApplyOperationService apply,
    WorkforceImportSemanticService semantic,
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
        return Ok(ApiResponse<object?>.Success(session is null ? null : Describe(session)));
    }

    [HttpGet("{sessionId:guid}")]
    public async Task<IActionResult> Get(Guid sessionId, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        var session = await sessions.GetAsync(sessionId, cancellationToken);
        if (session is null) return NotFoundResponse();
        SetEtag(session.Version);
        return Ok(ApiResponse<object>.Success(Describe(session)));
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
        return Ok(ApiResponse<object>.Success(DescribeIntake((WorkforceImportIntakeOutcome)outcome!)));
    }

    [HttpPut("{sessionId:guid}/header")]
    public Task<IActionResult> SelectHeader(Guid sessionId, [FromHeader(Name = "If-Match")] string? ifMatch, [FromBody] SelectHeaderRequest body, CancellationToken cancellationToken)
        => MutateSession(sessionId, ifMatch, version => sessions.SelectHeaderRowAsync(sessionId, body.HeaderRowIndex, version, Actor(), cancellationToken));

    [HttpPut("{sessionId:guid}/baseline")]
    public Task<IActionResult> ChangeBaseline(Guid sessionId, [FromHeader(Name = "If-Match")] string? ifMatch, [FromBody] ChangeBaselineRequest body, CancellationToken cancellationToken)
        => MutateSession(sessionId, ifMatch, version => sessions.ChangeBaselineDateAsync(sessionId, body.BaselineDate, version, Actor(), cancellationToken));

    [HttpPost("{sessionId:guid}/replace-source")]
    [RequestSizeLimit(SafeTabularSourceReader.MaxFileBytes)]
    public async Task<IActionResult> ReplaceSource(Guid sessionId, [FromHeader(Name = "If-Match")] string? ifMatch, [FromForm] IFormFile file, [FromForm] string? selectedSheet, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        if (!TryParseVersion(ifMatch, out var version)) return PreconditionRequired();
        await using var stream = file.OpenReadStream();
        return await MutateSession(sessionId, ifMatch, _ => sessions.ReplaceSourceAsync(sessionId,
            new WorkforceImportReplaceSourceRequest(stream, file.FileName, file.ContentType, selectedSheet, Actor()), version, cancellationToken));
    }

    [HttpPost("{sessionId:guid}/prepare")]
    public async Task<IActionResult> Prepare(Guid sessionId, [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        if (!TryParseVersion(ifMatch, out var version)) return PreconditionRequired();
        var result = await Guarded(() => review.PrepareAsync(sessionId, version, Actor(), cancellationToken));
        if (result is IActionResult error) return error;
        var prepared = (WorkforcePrepareResultDto)result!;
        SetEtag(prepared.Review.Version);
        return Ok(ApiResponse<WorkforcePrepareResultDto>.Success(prepared));
    }

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

    [HttpPut("{sessionId:guid}/decisions")]
    public async Task<IActionResult> ApplyDecision(Guid sessionId, [FromHeader(Name = "If-Match")] string? ifMatch, [FromBody] WorkforceDecisionRequest body, CancellationToken cancellationToken)
    {
        // Resolve a picked manager's public Employee Key to its canonical id (keys, not GUIDs, are public).
        var resolved = body;
        if (!string.IsNullOrWhiteSpace(body.ManagerEmployeeKey)
            && (body.ManagerRowNumber is not null || !string.IsNullOrWhiteSpace(body.ManagerReference)))
        {
            var id = await review.ResolveEmployeeKeyAsync(body.ManagerEmployeeKey!, cancellationToken);
            if (id is null) return UnprocessableEntity(ApiResponse.Failure("That employee could not be found."));
            resolved = body with { ManagerEmployeeId = id };
        }
        return await MutateReview(sessionId, ifMatch, version => review.ApplyDecisionAsync(sessionId, version, doc => resolved.Apply(doc), Actor(), cancellationToken));
    }

    [HttpPost("{sessionId:guid}/semantic-suggestions")]
    public async Task<IActionResult> SuggestMeanings(Guid sessionId, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        var result = await Guarded(() => semantic.SuggestAsync(sessionId, cancellationToken));
        return result is IActionResult error ? error : Ok(ApiResponse<WorkforceSemanticSuggestionsDto>.Success((WorkforceSemanticSuggestionsDto)result!));
    }

    [HttpPost("{sessionId:guid}/finish")]
    public Task<IActionResult> Finish(Guid sessionId, [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken cancellationToken)
        => MutateSession(sessionId, ifMatch, version => sessions.FinishNoWorkAsync(sessionId, version, Actor(), cancellationToken));

    [HttpPost("{sessionId:guid}/discard")]
    public async Task<IActionResult> Discard(Guid sessionId, [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        if (!TryParseVersion(ifMatch, out var version)) return PreconditionRequired();
        var result = await Guarded(() => sessions.DiscardAsync(sessionId, version, Actor(), cancellationToken));
        return result is IActionResult error ? error : Ok(ApiResponse.Success());
    }

    [HttpPost("{sessionId:guid}/commit")]
    public async Task<IActionResult> Commit(Guid sessionId, [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        if (!TryParseVersion(ifMatch, out var version)) return PreconditionRequired();
        var result = await Guarded(() => apply.CompleteImportAsync(sessionId, version, Actor(), cancellationToken));
        if (result is IActionResult error) return error;
        return Accepted(ApiResponse<WorkforceImportApplyStatusDto>.Success((WorkforceImportApplyStatusDto)result!));
    }

    [HttpGet("{sessionId:guid}/commit")]
    public async Task<IActionResult> GetCommitStatus(Guid sessionId, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        var status = await apply.GetStatusAsync(sessionId, cancellationToken);
        return status is null ? NotFoundResponse() : Ok(ApiResponse<WorkforceImportApplyStatusDto>.Success(status));
    }

    // ---- helpers ----

    private WorkforceImportActor Actor() => new(User.GetUserId(), User.GetFullName());

    private async Task<IActionResult> MutateSession(Guid sessionId, string? ifMatch, Func<uint, Task<WorkforceImportSession>> mutate)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        if (!TryParseVersion(ifMatch, out var version)) return PreconditionRequired();
        var result = await Guarded(() => mutate(version));
        if (result is IActionResult error) return error;
        var session = (WorkforceImportSession)result!;
        SetEtag(session.Version);
        return Ok(ApiResponse<object>.Success(Describe(session)));
    }

    private async Task<IActionResult> MutateReview(Guid sessionId, string? ifMatch, Func<uint, Task<WorkforceReviewSummaryDto>> mutate)
    {
        if (!accessPolicy.CanImportEmployees(User)) return Forbid();
        if (!TryParseVersion(ifMatch, out var version)) return PreconditionRequired();
        var result = await Guarded(() => mutate(version));
        if (result is IActionResult error) return error;
        var summary = (WorkforceReviewSummaryDto)result!;
        SetEtag(summary.Version);
        return Ok(ApiResponse<WorkforceReviewSummaryDto>.Success(summary));
    }

    private async Task<object?> Guarded(Func<Task> action) { await Guarded<object?>(async () => { await action(); return null; }); return null; }

    private async Task<object?> Guarded<T>(Func<Task<T>> action)
    {
        try { return await action(); }
        catch (WorkforceImportConcurrencyException) { return Conflict(ApiResponse.Failure("This import changed elsewhere. Refresh the latest review.")); }
        catch (WorkforceImportNotFoundException) { return NotFoundResponse(); }
        catch (WorkforceImportReviewException ex) { return UnprocessableEntity(ApiResponse.Failure(ex.Message)); }
        catch (TabularSourceException ex) { return StatusCode(ex.StatusCode, ApiResponse.Failure(ex.Message)); }
    }

    private static object DescribeIntake(WorkforceImportIntakeOutcome outcome) => new
    {
        kind = outcome.Kind.ToString(),
        replayed = outcome.Replayed,
        session = outcome.Session is null ? null : Describe(outcome.Session),
        sheetChoice = outcome.SheetChoice,
        headerCandidates = outcome.HeaderCandidates,
        conflictReason = outcome.ConflictReason,
    };

    private static object Describe(WorkforceImportSession s) => new
    {
        id = s.Id,
        status = s.Status.ToString(),
        baselineDate = s.BaselineDate,
        version = s.Version,
        source = new { fileName = s.Source?.OriginalFileName, format = s.Source?.SourceFormat, rowCount = s.Source?.RowCount, selectedSheet = s.SelectedSheetName },
        counts = new { s.NewCount, s.ExistingAnchorCount, s.NeedsAttentionCount, s.ExcludedCount },
        expiresAt = s.ExpiresAt,
    };

    private IActionResult NotFoundResponse() => NotFound(ApiResponse.Failure("Import session was not found."));
    private IActionResult PreconditionRequired() => StatusCode(StatusCodes.Status428PreconditionRequired, ApiResponse.Failure("This action requires the current review version (If-Match)."));
    private void SetEtag(uint version) => Response.Headers.ETag = $"\"{version}\"";
    private static bool TryParseVersion(string? value, out uint version) => uint.TryParse(value?.Trim().Trim('"'), out version);
}

public sealed record SelectHeaderRequest(int HeaderRowIndex);
public sealed record ChangeBaselineRequest(DateOnly BaselineDate);

/// <summary>Broadest-safe-scope decision request: exactly one decision kind per call.</summary>
public sealed record WorkforceDecisionRequest(
    Dictionary<int, string>? ColumnMappings, string? DateFormat, string? NameFormat,
    string? OrganizationSourceValue, Guid? OrganizationUnitId,
    int? ManagerRowNumber, Guid? ManagerEmployeeId, string? ManagerEmployeeKey, bool? NoManager,
    int? ExcludeRow, int? IncludeRow, int? KeepFusionUnchangedRow, int? KeepAsDistinctRow,
    bool? NormalizeWorkDatesToBaseline = null,
    // Reference-scoped manager resolution: point this manager reference at an existing employee, at a
    // person in this import, or none — applied to every row reporting to that reference.
    string? ManagerReference = null, int? ManagerImportRowNumber = null)
{
    public void Apply(WorkforceImportDecisionDoc doc)
    {
        if (ColumnMappings is not null) foreach (var (k, v) in ColumnMappings) doc.ColumnMappings[k] = v;
        if (DateFormat is not null) doc.DateFormat = DateFormat;
        if (NameFormat is not null) doc.NameFormat = NameFormat;
        if (OrganizationSourceValue is not null && OrganizationUnitId is { } orgId) doc.OrganizationBySourceValue[OrganizationSourceValue.Trim().ToLowerInvariant()] = orgId;

        // Reference-scoped manager decision — one choice resolves every report of this reference; setting
        // one option clears the others so re-deciding is clean.
        if (!string.IsNullOrWhiteSpace(ManagerReference))
        {
            var key = ManagerReference.Trim().ToUpperInvariant();
            doc.ManagerEmployeeByReference.Remove(key);
            doc.ManagerImportRowByReference.Remove(key);
            doc.NoManagerByReference.Remove(key);
            if (ManagerEmployeeId is { } refMgr) doc.ManagerEmployeeByReference[key] = refMgr;
            else if (ManagerImportRowNumber is { } refRow) doc.ManagerImportRowByReference[key] = refRow;
            else if (NoManager == true) doc.NoManagerByReference.Add(key);
        }
        else
        {
            // Legacy per-row manager decision (kept for compatibility).
            if (ManagerRowNumber is { } mr && ManagerEmployeeId is { } mgr) doc.ManagerEmployeeByRow[mr] = mgr;
            if (ManagerRowNumber is { } nmr && NoManager == true) doc.NoManagerRows.Add(nmr);
        }

        if (ExcludeRow is { } ex) doc.ExcludedRows.Add(ex);
        if (IncludeRow is { } inc) doc.ExcludedRows.Remove(inc);
        if (KeepFusionUnchangedRow is { } keep) doc.KeepFusionUnchangedRows.Add(keep);
        if (KeepAsDistinctRow is { } kd) doc.KeepAsDistinctRows.Add(kd);
        if (NormalizeWorkDatesToBaseline is { } normalize) doc.NormalizeWorkDatesToBaseline = normalize;
    }
}
