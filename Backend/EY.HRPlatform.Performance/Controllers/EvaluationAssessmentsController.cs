using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.Evaluations.Assessments.Commands;
using EY.HRPlatform.Performance.Features.Evaluations.Assessments.Queries;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/assessments")]
[Authorize]
public sealed class EvaluationAssessmentsController(ISender sender) : ControllerBase
{
    // ─── Employee ─────────────────────────────────────────────────────────────

    [HttpGet("mine")]
    public async Task<IActionResult> Mine([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Respond(await sender.Send(new GetMyEvaluationsQuery(User, page, pageSize), ct));

    [HttpGet("rounds/{roundId:guid}/self")]
    public async Task<IActionResult> MyWorkspace(Guid roundId, CancellationToken ct) =>
        Respond(await sender.Send(new GetMyAssessmentWorkspaceQuery(User, roundId), ct));

    [HttpPost("assignments/{assignmentId:guid}/self/draft")]
    public async Task<IActionResult> SaveSelfDraft(Guid assignmentId, SaveDraftRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken ct)
    {
        if (!TryVersion(ifMatch, out var version)) return PreconditionRequired();
        return Respond(await sender.Send(new SaveSelfDraftCommand(User, assignmentId, request.ToInput(), version), ct));
    }

    [HttpPost("assignments/{assignmentId:guid}/self/submit")]
    public async Task<IActionResult> SubmitSelf(Guid assignmentId, [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken ct)
    {
        if (!TryVersion(ifMatch, out var version)) return PreconditionRequired();
        return Respond(await sender.Send(new SubmitSelfCommand(User, assignmentId, version), ct));
    }

    [HttpPost("assignments/{assignmentId:guid}/acknowledge")]
    public async Task<IActionResult> Acknowledge(Guid assignmentId, AcknowledgeRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken ct)
    {
        if (!TryVersion(ifMatch, out var version)) return PreconditionRequired();
        return Respond(await sender.Send(new AcknowledgeEvaluationCommand(User, assignmentId, request.Comment, version), ct));
    }

    // ─── Manager ──────────────────────────────────────────────────────────────

    [HttpGet("rounds/{roundId:guid}/team")]
    public async Task<IActionResult> TeamQueue(Guid roundId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Respond(await sender.Send(new GetTeamAssessmentQueueQuery(User, roundId, page, pageSize), ct));

    [HttpGet("rounds/{roundId:guid}/participants/{participantId:guid}")]
    public async Task<IActionResult> ParticipantWorkspace(Guid roundId, Guid participantId, CancellationToken ct) =>
        Respond(await sender.Send(new GetParticipantAssessmentWorkspaceQuery(User, roundId, participantId), ct));

    [HttpPost("assignments/{assignmentId:guid}/manager/draft")]
    public async Task<IActionResult> SaveManagerDraft(Guid assignmentId, SaveDraftRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken ct)
    {
        if (!TryVersion(ifMatch, out var version)) return PreconditionRequired();
        return Respond(await sender.Send(new SaveManagerDraftCommand(User, assignmentId, request.ToInput(), version), ct));
    }

    [HttpPost("assignments/{assignmentId:guid}/manager/submit")]
    public async Task<IActionResult> SubmitManager(Guid assignmentId, [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken ct)
    {
        if (!TryVersion(ifMatch, out var version)) return PreconditionRequired();
        return Respond(await sender.Send(new SubmitManagerCommand(User, assignmentId, version), ct));
    }

    [HttpPost("assignments/{assignmentId:guid}/self/reopen")]
    public async Task<IActionResult> ReopenSelf(Guid assignmentId, ReopenRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken ct)
    {
        if (!TryVersion(ifMatch, out var version)) return PreconditionRequired();
        return Respond(await sender.Send(new ReopenSelfCommand(User, assignmentId, request.Reason, version), ct));
    }

    [HttpPost("assignments/{assignmentId:guid}/finalize")]
    public async Task<IActionResult> Finalize(Guid assignmentId, FinalizeRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken ct)
    {
        if (!TryVersion(ifMatch, out var version)) return PreconditionRequired();
        return Respond(await sender.Send(new FinalizeEvaluationCommand(User, assignmentId, request.ToInput(), version), ct));
    }

    // ─── HR ───────────────────────────────────────────────────────────────────

    [HttpGet("rounds/{roundId:guid}/completion")]
    public async Task<IActionResult> Completion(Guid roundId, CancellationToken ct) =>
        Respond(await sender.Send(new GetRoundCompletionQuery(User, roundId), ct));

    private IActionResult Respond<T>(Result<T> result) => result.IsSuccess
        ? Ok(ApiResponse<T>.Success(result.Value))
        : MapFailure(result.Error);

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.Contains("Forbidden", StringComparison.OrdinalIgnoreCase)) return Forbid();
        if (error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase)) return NotFound(ApiResponse.Failure(error.Message));
        if (error.Code.Contains("Conflict", StringComparison.OrdinalIgnoreCase) || error.Code.Contains("NotActionable", StringComparison.OrdinalIgnoreCase))
            return Conflict(ApiResponse.Failure(error.Message));
        if (error.Code.Contains("Invalid", StringComparison.OrdinalIgnoreCase) || error.Code.Contains("Validation", StringComparison.OrdinalIgnoreCase) || error.Code.Contains("Incomplete", StringComparison.OrdinalIgnoreCase))
            return UnprocessableEntity(ApiResponse.Failure(error.Message, error.Details));
        return BadRequest(ApiResponse.Failure(error.Message));
    }

    private IActionResult PreconditionRequired() => StatusCode(StatusCodes.Status428PreconditionRequired,
        ApiResponse.Failure("If-Match header with the current version is required."));

    private static bool TryVersion(string? value, out uint version)
    {
        version = 0; if (string.IsNullOrWhiteSpace(value)) return false;
        var normalized = value.Trim().Trim('"');
        if (normalized.StartsWith("W/", StringComparison.OrdinalIgnoreCase)) normalized = normalized[2..].Trim('"');
        return uint.TryParse(normalized, out version);
    }
}

public sealed record ObjectiveRatingRequest(Guid ObjectiveSnapshotId, int? RatingOrdinal, string? Comment);
public sealed record SkillRatingRequest(Guid SkillSnapshotItemId, int? ProficiencyOrdinal, string? Comment);
public sealed record QuestionAnswerRequest(
    Guid QuestionSnapshotId, string? TextAnswer, int? RatingOrdinal, bool IsNotApplicable, string? NotApplicableReason);

public sealed record SaveDraftRequest(
    IReadOnlyList<ObjectiveRatingRequest>? ObjectiveRatings,
    IReadOnlyList<SkillRatingRequest>? SkillRatings,
    IReadOnlyList<QuestionAnswerRequest>? QuestionAnswers)
{
    public EvaluationAssessmentDraftInput ToInput() => new(
        (ObjectiveRatings ?? []).Select(r => new EvaluationObjectiveRatingInput(r.ObjectiveSnapshotId, r.RatingOrdinal, r.Comment)).ToArray(),
        (SkillRatings ?? []).Select(r => new EvaluationSkillRatingInput(r.SkillSnapshotItemId, r.ProficiencyOrdinal, r.Comment)).ToArray(),
        (QuestionAnswers ?? []).Select(r => new EvaluationQuestionAnswerInput(
            r.QuestionSnapshotId, r.TextAnswer, r.RatingOrdinal, r.IsNotApplicable, r.NotApplicableReason)).ToArray());
}

public sealed record FinalizeRequest(int? OverallObjectivesRatingOrdinal, int? OverallSkillsRatingOrdinal, string DiscussionSummary)
{
    public EvaluationFinalizationInput ToInput() => new(OverallObjectivesRatingOrdinal, OverallSkillsRatingOrdinal, DiscussionSummary);
}

public sealed record ReopenRequest(string Reason);
public sealed record AcknowledgeRequest(string? Comment);
