using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Evaluations.Configuration.Commands;
using EY.HRPlatform.Performance.Features.Evaluations.Configuration.Dtos;
using EY.HRPlatform.Performance.Features.Evaluations.Configuration.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/evaluation-config")]
[Authorize]
public sealed class EvaluationConfigurationController(
    ISender sender,
    IPerformanceAccessPolicyService access) : ControllerBase
{
    [HttpGet("scales")]
    public async Task<IActionResult> ListScales([FromQuery] EvaluationConfigStatus? status, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(User)) return Forbid();
        var result = await sender.Send(new ListEvaluationRatingScalesQuery(User, status), ct);
        return Respond(result);
    }

    [HttpGet("scales/{id:guid}")]
    public async Task<IActionResult> GetScale(Guid id, CancellationToken ct) =>
        Respond(await sender.Send(new GetEvaluationRatingScaleQuery(User, id), ct));

    [HttpPost("scales")]
    public async Task<IActionResult> CreateScale(EvaluationRatingScaleWriteRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new CreateEvaluationRatingScaleCommand(User, request.Name, request.Description, request.Levels), ct));

    [HttpPut("scales/{id:guid}")]
    public async Task<IActionResult> UpdateScale(Guid id, EvaluationRatingScaleWriteRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new UpdateEvaluationRatingScaleCommand(User, id, request.Name, request.Description, request.Levels), ct));

    [HttpPost("scales/{id:guid}/status")]
    public async Task<IActionResult> SetScaleStatus(Guid id, EvaluationStatusRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new SetEvaluationRatingScaleStatusCommand(User, id, request.Status), ct));

    [HttpPost("scales/{id:guid}/duplicate")]
    public async Task<IActionResult> DuplicateScale(Guid id, DuplicateEvaluationConfigurationRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new DuplicateEvaluationRatingScaleCommand(User, id, request.Name), ct));

    [HttpGet("templates")]
    public async Task<IActionResult> ListTemplates([FromQuery] EvaluationConfigStatus? status, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(User)) return Forbid();
        return Respond(await sender.Send(new ListEvaluationTemplatesQuery(User, status), ct));
    }

    [HttpGet("templates/{id:guid}")]
    public async Task<IActionResult> GetTemplate(Guid id, CancellationToken ct) =>
        Respond(await sender.Send(new GetEvaluationTemplateQuery(User, id), ct));

    [HttpPost("templates")]
    public async Task<IActionResult> CreateTemplate(EvaluationTemplateWriteRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new CreateEvaluationTemplateCommand(
            User, request.Name, request.Purpose, request.ParticipantInstructions, request.Sections), ct));

    [HttpPut("templates/{id:guid}")]
    public async Task<IActionResult> UpdateTemplate(Guid id, EvaluationTemplateWriteRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new UpdateEvaluationTemplateCommand(
            User, id, request.Name, request.Purpose, request.ParticipantInstructions, request.Sections), ct));

    [HttpPost("templates/{id:guid}/status")]
    public async Task<IActionResult> SetTemplateStatus(Guid id, EvaluationStatusRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new SetEvaluationTemplateStatusCommand(User, id, request.Status), ct));

    [HttpPost("templates/{id:guid}/duplicate")]
    public async Task<IActionResult> DuplicateTemplate(Guid id, DuplicateEvaluationConfigurationRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new DuplicateEvaluationTemplateCommand(User, id, request.Name), ct));

    [HttpGet("templates/{id:guid}/preview")]
    public async Task<IActionResult> PreviewTemplate(Guid id, [FromQuery] EvaluationTargetRater rater, CancellationToken ct) =>
        Respond(await sender.Send(new PreviewEvaluationTemplateQuery(User, id, rater), ct));

    private IActionResult Respond<T>(Result<T> result) => result.IsSuccess
        ? Ok(ApiResponse<T>.Success(result.Value))
        : MapFailure(result.Error);

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.Contains("Forbidden", StringComparison.OrdinalIgnoreCase)) return Forbid();
        if (error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase)) return NotFound(ApiResponse.Failure(error.Message));
        if (error.Code.Contains("Conflict", StringComparison.OrdinalIgnoreCase)) return Conflict(ApiResponse.Failure(error.Message));
        if (error.Code.Contains("Invalid", StringComparison.OrdinalIgnoreCase) || error.Code.Contains("Validation", StringComparison.OrdinalIgnoreCase))
            return UnprocessableEntity(ApiResponse.Failure(error.Message));
        return BadRequest(ApiResponse.Failure(error.Message));
    }
}

public sealed record EvaluationRatingScaleWriteRequest(
    string Name, string? Description, IReadOnlyList<EvaluationRatingScaleLevelInput> Levels);
public sealed record EvaluationTemplateWriteRequest(
    string Name, string? Purpose, string? ParticipantInstructions,
    IReadOnlyList<EvaluationTemplateSectionInput> Sections);
public sealed record EvaluationStatusRequest(EvaluationConfigStatus Status);
public sealed record DuplicateEvaluationConfigurationRequest(string Name);
