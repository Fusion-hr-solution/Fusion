using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Cycles.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/cycles")]
[Authorize]
public class PerformanceCyclesController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? type,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanViewCycles(User))
        {
            return Forbid();
        }

        var result = await sender.Send(new GetCyclesQuery(search, status, type, page, pageSize), cancellationToken);
        return Ok(ApiResponse<PagedResponse<PerformanceCycleSummaryDto>>.Success(result));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewCycles(User))
        {
            return Forbid();
        }

        var result = await sender.Send(new GetCycleByIdQuery(id), cancellationToken);
        return ToDetailResponse(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreatePerformanceCycleRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageCycles(User))
        {
            return Forbid();
        }

        if (!Enum.TryParse<PerformanceCycleType>(request.Type, ignoreCase: true, out var type))
        {
            return BadRequest(ApiResponse.Failure($"Unknown cycle type '{request.Type}'."));
        }

        var result = await sender.Send(new CreateCycleCommand(
            request.Name,
            request.Description,
            type,
            request.PeriodStart,
            request.PeriodEnd,
            request.ObjectiveSettingDeadline,
            request.PopulationIncludeInactive), cancellationToken);

        if (result.IsFailure)
        {
            return MapFailure(result.Error);
        }

        SetETag(result.Value.Version);
        return CreatedAtAction(nameof(GetById), new { id = result.Value.Id },
            ApiResponse<PerformanceCycleDetailDto>.Success(result.Value));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdatePerformanceCycleRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageCycles(User))
        {
            return Forbid();
        }

        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return PreconditionRequired();
        }

        if (!Enum.TryParse<PerformanceCycleType>(request.Type, ignoreCase: true, out var type))
        {
            return BadRequest(ApiResponse.Failure($"Unknown cycle type '{request.Type}'."));
        }

        var result = await sender.Send(new UpdateCycleCommand(
            id,
            expectedVersion,
            request.Name,
            request.Description,
            type,
            request.PeriodStart,
            request.PeriodEnd,
            request.ObjectiveSettingDeadline,
            request.PopulationIncludeInactive), cancellationToken);

        return ToDetailResponse(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        Guid id,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageCycles(User))
        {
            return Forbid();
        }

        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return PreconditionRequired();
        }

        var result = await sender.Send(new DeleteCycleCommand(id, expectedVersion), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : NoContent();
    }

    [HttpPut("{id:guid}/population")]
    public async Task<IActionResult> SetPopulation(
        Guid id,
        [FromBody] SetCyclePopulationRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageCycles(User))
        {
            return Forbid();
        }

        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return PreconditionRequired();
        }

        var result = await sender.Send(new SetCyclePopulationCommand(
            id, expectedVersion, request.PopulationIncludeInactive, request.Rules), cancellationToken);
        return ToDetailResponse(result);
    }

    [HttpGet("{id:guid}/population/preview")]
    public async Task<IActionResult> PreviewPopulation(Guid id, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageCycles(User))
        {
            return Forbid();
        }

        var result = await sender.Send(new GetCyclePopulationPreviewQuery(id), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<CyclePopulationPreviewDto>.Success(result.Value));
    }

    [HttpPost("{id:guid}/publish")]
    public Task<IActionResult> Publish(Guid id, [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken cancellationToken)
        => Transition(id, ifMatch, version => new PublishCycleCommand(id, version), cancellationToken);

    [HttpPost("{id:guid}/activate")]
    public Task<IActionResult> Activate(Guid id, [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken cancellationToken)
        => Transition(id, ifMatch, version => new ActivateCycleCommand(id, version), cancellationToken);

    [HttpPost("{id:guid}/ready-to-launch")]
    public async Task<IActionResult> MarkReadyToLaunch(
        Guid id,
        [FromBody] MarkCycleReadyToLaunchRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanOperateCycles(User))
            return Forbid();
        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var result = await sender.Send(
            new MarkCycleReadyToLaunchCommand(id, expectedVersion, request.AcceptCurrentWorkforceDelta), cancellationToken);
        return ToDetailResponse(result);
    }

    [HttpPost("{id:guid}/responsibilities")]
    public async Task<IActionResult> CurateResponsibility(
        Guid id,
        [FromBody] CurateCampaignResponsibilityRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageCycles(User))
            return Forbid();
        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();
        if (!Enum.TryParse<CampaignResponsibilityDuty>(request.Duty, true, out var duty))
            return BadRequest(ApiResponse.Failure($"Unknown responsibility duty '{request.Duty}'."));

        var result = await sender.Send(new CurateCampaignResponsibilityCommand(
            id, expectedVersion, request.SubjectEmployeeId, request.AssigneeEmployeeId,
            duty, request.RelationshipSource, request.OverrideReason), cancellationToken);
        if (result.IsFailure)
            return MapFailure(result.Error);
        SetETag(result.Value.CycleVersion);
        return Ok(ApiResponse<CuratedCampaignResponsibilityDto>.Success(result.Value));
    }

    [HttpGet("{id:guid}/responsibilities")]
    public async Task<IActionResult> GetResponsibilities(
        Guid id,
        [FromQuery] string state = "all",
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanManageCycles(User))
            return Forbid();

        var result = await sender.Send(new GetCampaignResponsibilitiesQuery(id, state), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<CampaignResponsibilitiesDto>.Success(result.Value));
    }

    [HttpGet("{id:guid}/responsibilities/{subjectEmployeeId:guid}/history")]
    public async Task<IActionResult> GetResponsibilityHistory(
        Guid id,
        Guid subjectEmployeeId,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanManageCycles(User))
            return Forbid();

        var result = await sender.Send(new GetCampaignResponsibilityHistoryQuery(id, subjectEmployeeId), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<IReadOnlyList<CampaignResponsibilitySummaryDto>>.Success(result.Value));
    }

    [HttpPost("{id:guid}/close")]
    public Task<IActionResult> Close(Guid id, [FromHeader(Name = "If-Match")] string? ifMatch, CancellationToken cancellationToken)
        => Transition(id, ifMatch, version => new CloseCycleCommand(id, version), cancellationToken);

    [HttpGet("{id:guid}/participants")]
    public async Task<IActionResult> GetParticipants(
        Guid id,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanViewCycles(User))
        {
            return Forbid();
        }

        var result = await sender.Send(new GetCycleParticipantsQuery(id, search, page, pageSize), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<PagedResponse<CycleParticipantDto>>.Success(result.Value));
    }

    [HttpGet("{id:guid}/audit")]
    public async Task<IActionResult> GetAudit(Guid id, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewCycles(User))
        {
            return Forbid();
        }

        var result = await sender.Send(new GetCycleAuditQuery(id), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<IReadOnlyList<CycleAuditEventDto>>.Success(result.Value));
    }

    [HttpGet("{id:guid}/readiness")]
    public async Task<IActionResult> GetReadiness(Guid id, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageCycles(User))
        {
            return Forbid();
        }

        var result = await sender.Send(new GetCycleReadinessQuery(id), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<CycleReadinessDto>.Success(result.Value));
    }

    private async Task<IActionResult> Transition(
        Guid id,
        string? ifMatch,
        Func<uint, IRequest<Result<PerformanceCycleDetailDto>>> commandFactory,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanOperateCycles(User))
        {
            return Forbid();
        }

        if (!TryParseVersion(ifMatch, out var expectedVersion))
        {
            return PreconditionRequired();
        }

        var result = await sender.Send(commandFactory(expectedVersion), cancellationToken);
        return ToDetailResponse(result);
    }

    private IActionResult ToDetailResponse(Result<PerformanceCycleDetailDto> result)
    {
        if (result.IsFailure)
        {
            return MapFailure(result.Error);
        }

        SetETag(result.Value.Version);
        return Ok(ApiResponse<PerformanceCycleDetailDto>.Success(result.Value));
    }

    private void SetETag(uint version) => Response.Headers.ETag = $"\"{version}\"";

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(ApiResponse.Failure(error.Message));
        }

        if (error.Code.Contains("Invalid", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(ApiResponse.Failure(error.Message));
        }

        return Conflict(ApiResponse.Failure(error.Message));
    }

    private IActionResult PreconditionRequired()
        => StatusCode(StatusCodes.Status428PreconditionRequired,
            ApiResponse.Failure("If-Match header with the current version is required."));

    private static bool TryParseVersion(string? ifMatch, out uint version)
    {
        version = 0;
        if (string.IsNullOrWhiteSpace(ifMatch))
        {
            return false;
        }

        var trimmed = ifMatch.Trim().Trim('"');
        if (trimmed.StartsWith("W/", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[2..].Trim('"');
        }

        return uint.TryParse(trimmed, out version);
    }
}
