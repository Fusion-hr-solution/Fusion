using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Commands;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/evaluations")]
[Authorize]
public sealed class EvaluationRoundsController(
    ISender sender,
    IPerformanceAccessPolicyService access) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid? campaignId, CancellationToken ct)
    {
        if (!CanAdmin()) return Forbid();
        return Respond(await sender.Send(new ListEvaluationRoundsQuery(User, campaignId), ct));
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateEvaluationRoundRequest request, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(User)) return Forbid();
        return Respond(await sender.Send(new CreateEvaluationRoundCommand(
            User, request.CampaignId, request.Name, request.Purpose, request.Type, request.AssessmentModel), ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        if (!CanAdmin()) return Forbid();
        return Respond(await sender.Send(new GetEvaluationRoundQuery(User, id), ct));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateEvaluationRoundRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(User)) return Forbid();
        if (!TryVersion(ifMatch, out var version)) return PreconditionRequired();
        return Respond(await sender.Send(new UpdateEvaluationRoundCommand(
            User, id, request.Name, request.Purpose, request.Type, request.AssessmentModel, version), ct));
    }

    [HttpPut("{id:guid}/configuration")]
    public async Task<IActionResult> SelectConfiguration(Guid id, EvaluationRoundConfigurationRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(User)) return Forbid();
        if (!TryVersion(ifMatch, out var version)) return PreconditionRequired();
        return Respond(await sender.Send(new SelectEvaluationRoundConfigurationCommand(
            User, id, request.RatingScaleId, request.TemplateId, version), ct));
    }

    [HttpPut("{id:guid}/deadlines")]
    public async Task<IActionResult> SetDeadlines(Guid id, EvaluationRoundDeadlinesRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(User)) return Forbid();
        if (!TryVersion(ifMatch, out var version)) return PreconditionRequired();
        return Respond(await sender.Send(new SetEvaluationRoundDeadlinesCommand(
            User, id, request.SelfAssessmentDeadline, request.ManagerAssessmentDeadline,
            request.FinalizationDeadline, version), ct));
    }

    [HttpGet("{id:guid}/readiness")]
    public async Task<IActionResult> Readiness(Guid id, CancellationToken ct)
    {
        if (!CanAdmin()) return Forbid();
        return Respond(await sender.Send(new GetEvaluationRoundReadinessQuery(User, id), ct));
    }

    [HttpPut("{id:guid}/participants/{employeeId:guid}/exclusion")]
    public async Task<IActionResult> SetExclusion(Guid id, Guid employeeId, EvaluationRoundExclusionRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(User)) return Forbid();
        if (!TryVersion(ifMatch, out var version)) return PreconditionRequired();
        return Respond(await sender.Send(new SetEvaluationRoundExclusionCommand(
            User, id, employeeId, request.Excluded, request.Reason, version), ct));
    }

    [HttpPut("{id:guid}/participants/{employeeId:guid}/reviewer")]
    public async Task<IActionResult> CorrectReviewer(Guid id, Guid employeeId, EvaluationReviewerCorrectionRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(User)) return Forbid();
        if (!TryVersion(ifMatch, out var version)) return PreconditionRequired();
        return Respond(await sender.Send(new CorrectEvaluationRoundReviewerCommand(
            User, id, employeeId, request.ReviewerEmployeeId, request.ReviewerName, request.Reason, version), ct));
    }

    [HttpPost("{id:guid}/launch")]
    public async Task<IActionResult> Launch(Guid id, [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken ct)
    {
        if (!access.CanOperateEvaluations(User)) return Forbid();
        if (!TryVersion(ifMatch, out var version)) return PreconditionRequired();
        return Respond(await sender.Send(new LaunchEvaluationRoundCommand(User, id, version), ct));
    }

    [HttpPost("{id:guid}/deadline-extensions")]
    public async Task<IActionResult> ExtendDeadline(Guid id, ExtendEvaluationDeadlineRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken ct)
    {
        if (!access.CanOperateEvaluations(User)) return Forbid();
        if (!TryVersion(ifMatch, out var version)) return PreconditionRequired();
        return Respond(await sender.Send(new ExtendEvaluationRoundDeadlineCommand(
            User, id, request.DeadlineKind, request.NewDeadline, request.Reason, version), ct));
    }

    [HttpGet("{id:guid}/assignments")]
    public async Task<IActionResult> Roster(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 25,
        CancellationToken ct = default)
    {
        if (!CanAdmin()) return Forbid();
        return Respond(await sender.Send(new GetEvaluationAssignmentRosterQuery(User, id, page, pageSize), ct));
    }

    [HttpGet("mine")]
    public async Task<IActionResult> Mine(CancellationToken ct)
    {
        if (!access.CanViewOwnEvaluations(User)) return Forbid();
        return Respond(await sender.Send(new GetMyEvaluationAssignmentsQuery(User), ct));
    }

    [HttpGet("team")]
    public async Task<IActionResult> Team(CancellationToken ct)
    {
        if (!access.CanViewTeamEvaluations(User)) return Forbid();
        return Respond(await sender.Send(new GetTeamEvaluationAssignmentsQuery(User), ct));
    }

    private bool CanAdmin() => access.CanManageEvaluations(User) || access.CanOperateEvaluations(User);
    private IActionResult Respond<T>(Result<T> result) => result.IsSuccess
        ? Ok(ApiResponse<T>.Success(result.Value))
        : MapFailure(result.Error);
    private IActionResult MapFailure(Error error)
    {
        if (error.Code.Contains("Forbidden", StringComparison.OrdinalIgnoreCase)) return Forbid();
        if (error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase)) return NotFound(ApiResponse.Failure(error.Message));
        if (error.Code.Contains("Conflict", StringComparison.OrdinalIgnoreCase) || error.Code.Contains("Already", StringComparison.OrdinalIgnoreCase) || error.Code.Contains("NotReady", StringComparison.OrdinalIgnoreCase))
            return Conflict(ApiResponse.Failure(error.Message));
        if (error.Code.Contains("Invalid", StringComparison.OrdinalIgnoreCase) || error.Code.Contains("Validation", StringComparison.OrdinalIgnoreCase))
            return UnprocessableEntity(ApiResponse.Failure(error.Message));
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

public sealed record CreateEvaluationRoundRequest(
    Guid CampaignId, string Name, string? Purpose, EvaluationRoundType Type, EvaluationAssessmentModel AssessmentModel);
public sealed record UpdateEvaluationRoundRequest(
    string Name, string? Purpose, EvaluationRoundType Type, EvaluationAssessmentModel AssessmentModel);
public sealed record EvaluationRoundConfigurationRequest(Guid RatingScaleId, Guid TemplateId);
public sealed record EvaluationRoundDeadlinesRequest(
    DateTime? SelfAssessmentDeadline, DateTime ManagerAssessmentDeadline, DateTime FinalizationDeadline);
public sealed record EvaluationRoundExclusionRequest(bool Excluded, string? Reason);
public sealed record EvaluationReviewerCorrectionRequest(Guid ReviewerEmployeeId, string ReviewerName, string Reason);
public sealed record ExtendEvaluationDeadlineRequest(EvaluationDeadlineKind DeadlineKind, DateTime NewDeadline, string Reason);
