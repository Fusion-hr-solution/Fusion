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

    [HttpGet("by-slug/{slug}")]
    public async Task<IActionResult> GetBySlug(string slug, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewCycles(User))
        {
            return Forbid();
        }

        var result = await sender.Send(new GetCycleBySlugQuery(slug), cancellationToken);
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

        if (!TryGetDraftSchedule(
                request.ReferenceYear,
                request.PeriodStart,
                request.PeriodEnd,
                request.ObjectiveSettingDeadline,
                request.PlanningOpeningDate,
                request.EmployeeSubmissionDeadline,
                request.ManagerApprovalDeadline,
                request.ExpectedPlanningLockDate,
                out var schedule,
                out var validationFailure))
        {
            return validationFailure;
        }

        var result = await sender.Send(new CreateCycleCommand(
            request.Name,
            request.Purpose ?? request.Description,
            schedule.ReferenceYear,
            schedule.PlanningOpeningDate,
            schedule.EmployeeSubmissionDeadline,
            schedule.ManagerApprovalDeadline,
            schedule.ExpectedPlanningLockDate), cancellationToken);

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

        if (!TryGetDraftSchedule(
                request.ReferenceYear,
                request.PeriodStart,
                request.PeriodEnd,
                request.ObjectiveSettingDeadline,
                request.PlanningOpeningDate,
                request.EmployeeSubmissionDeadline,
                request.ManagerApprovalDeadline,
                request.ExpectedPlanningLockDate,
                out var schedule,
                out var validationFailure))
        {
            return validationFailure;
        }

        var result = await sender.Send(new UpdateCycleCommand(
            id,
            expectedVersion,
            request.Name,
            request.Purpose ?? request.Description,
            schedule.ReferenceYear,
            schedule.PlanningOpeningDate,
            schedule.EmployeeSubmissionDeadline,
            schedule.ManagerApprovalDeadline,
            schedule.ExpectedPlanningLockDate), cancellationToken);

        return ToDetailResponse(result);
    }

    [HttpGet("{id:guid}/strategic-objectives")]
    public async Task<IActionResult> GetStrategicObjectives(Guid id, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewCycles(User))
            return Forbid();

        var result = await sender.Send(new GetCampaignStrategicObjectivesQuery(id), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<IReadOnlyList<CampaignStrategicObjectiveDto>>.Success(result.Value));
    }

    [HttpPost("{id:guid}/strategic-objectives")]
    public async Task<IActionResult> AddStrategicObjective(
        Guid id,
        [FromBody] UpsertCampaignStrategicObjectiveRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageCycles(User))
            return Forbid();

        var result = await sender.Send(new AddCampaignStrategicObjectiveCommand(
            id,
            request.Title,
            request.Description,
            request.ResponsibleFunctionLabel), cancellationToken);

        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<CampaignStrategicObjectiveDto>.Success(result.Value));
    }

    [HttpPut("{id:guid}/strategic-objectives/{objectiveId:guid}")]
    public async Task<IActionResult> UpdateStrategicObjective(
        Guid id,
        Guid objectiveId,
        [FromBody] UpsertCampaignStrategicObjectiveRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageCycles(User))
            return Forbid();
        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var result = await sender.Send(new UpdateCampaignStrategicObjectiveCommand(
            id,
            objectiveId,
            expectedVersion,
            request.Title,
            request.Description,
            request.ResponsibleFunctionLabel), cancellationToken);

        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<CampaignStrategicObjectiveDto>.Success(result.Value));
    }

    [HttpPut("{id:guid}/strategic-objectives/{objectiveId:guid}/active-state")]
    public async Task<IActionResult> ToggleStrategicObjective(
        Guid id,
        Guid objectiveId,
        [FromBody] ToggleCampaignStrategicObjectiveRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageCycles(User))
            return Forbid();
        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var result = await sender.Send(new ToggleCampaignStrategicObjectiveCommand(
            id,
            objectiveId,
            expectedVersion,
            request.IsActive), cancellationToken);

        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<CampaignStrategicObjectiveDto>.Success(result.Value));
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

    // ─── Objective-planning population, readiness, approver override, launch ──────

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
        if (!accessPolicy.CanViewCycles(User))
        {
            return Forbid();
        }

        var result = await sender.Send(new GetCyclePopulationPreviewQuery(id), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<CyclePopulationPreviewDto>.Success(result.Value));
    }

    [HttpGet("{id:guid}/readiness")]
    public async Task<IActionResult> GetReadiness(Guid id, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewCycles(User))
        {
            return Forbid();
        }

        var result = await sender.Send(new GetCycleReadinessQuery(id), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<CycleReadinessDto>.Success(result.Value));
    }

    [HttpPut("{id:guid}/participants/{employeeId:guid}/approver")]
    public async Task<IActionResult> OverrideApprover(
        Guid id,
        Guid employeeId,
        [FromBody] OverrideParticipantApproverRequest request,
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

        var result = await sender.Send(new OverrideParticipantApproverCommand(
            id, expectedVersion, employeeId, request.ApproverEmployeeId, request.Reason), cancellationToken);
        return ToDetailResponse(result);
    }

    [HttpPost("{id:guid}/launch")]
    public async Task<IActionResult> Launch(
        Guid id,
        [FromHeader(Name = "If-Match")] string? ifMatch,
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

        var result = await sender.Send(new LaunchCampaignCommand(id, expectedVersion), cancellationToken);
        if (result.IsFailure)
        {
            return MapFailure(result.Error);
        }

        SetETag(result.Value.Version);
        return Ok(ApiResponse<CampaignLaunchResultDto>.Success(result.Value));
    }

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

        if (error.Code.Contains("Invalid", StringComparison.OrdinalIgnoreCase)
            || error.Code.Contains("Required", StringComparison.OrdinalIgnoreCase)
            || error.Code.Contains("Missing", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(ApiResponse.Failure(error.Message));
        }

        return Conflict(ApiResponse.Failure(error.Message));
    }

    private IActionResult PreconditionRequired()
        => StatusCode(StatusCodes.Status428PreconditionRequired,
            ApiResponse.Failure("If-Match header with the current version is required."));

    private static bool TryGetDraftSchedule(
        int? referenceYear,
        DateTime? legacyPeriodStart,
        DateTime? legacyPeriodEnd,
        DateTime? legacyObjectiveSettingDeadline,
        DateTime? planningOpeningDate,
        DateTime? employeeSubmissionDeadline,
        DateTime? managerApprovalDeadline,
        DateTime? expectedPlanningLockDate,
        out DraftScheduleRequest schedule,
        out IActionResult validationFailure)
    {
        schedule = default;
        validationFailure = null!;

        var opening = planningOpeningDate ?? legacyPeriodStart;
        var submission = employeeSubmissionDeadline ?? legacyObjectiveSettingDeadline;
        var approval = managerApprovalDeadline ?? submission;
        var lockDate = expectedPlanningLockDate ?? legacyPeriodEnd;
        var year = referenceYear ?? opening?.Year;

        if (!year.HasValue || !opening.HasValue || !submission.HasValue || !approval.HasValue || !lockDate.HasValue)
        {
            validationFailure = new BadRequestObjectResult(ApiResponse.Failure(
                "Reference year and all four planning schedule dates are required."));
            return false;
        }

        schedule = new DraftScheduleRequest(year.Value, opening.Value, submission.Value, approval.Value, lockDate.Value);
        return true;
    }

    private readonly record struct DraftScheduleRequest(
        int ReferenceYear,
        DateTime PlanningOpeningDate,
        DateTime EmployeeSubmissionDeadline,
        DateTime ManagerApprovalDeadline,
        DateTime ExpectedPlanningLockDate);

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
