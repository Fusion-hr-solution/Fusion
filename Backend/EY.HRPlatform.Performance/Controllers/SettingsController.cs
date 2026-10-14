using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Settings;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Authorize]
[Route("api/performance/settings")]
public sealed class SettingsController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<CycleSettingsDto>>> Get(CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new GetCycleSettingsQuery(), cancellationToken));
    }

    [HttpPut]
    public async Task<ActionResult<ApiResponse<CycleSettingsDto>>> Update(
        [FromBody] UpdateCycleSettingsRequest request,
        CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new UpdateCycleSettingsCommand(request), cancellationToken));
    }

    [HttpGet("rating-scale")]
    public async Task<ActionResult<ApiResponse<RatingScaleDto>>> GetRatingScale(CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new GetRatingScaleQuery(), cancellationToken));
    }

    [HttpPut("rating-scale")]
    public async Task<ActionResult<ApiResponse<RatingScaleDto>>> UpdateRatingScale(
        [FromBody] UpdateRatingScaleRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new UpdateRatingScaleCommand(request), cancellationToken));
    }

    [HttpGet("competencies")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<CompetencyDto>>>> ListCompetencies(CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new ListCompetenciesQuery(), cancellationToken));
    }

    [HttpPost("competencies")]
    public async Task<ActionResult<ApiResponse<CompetencyDto>>> CreateCompetency([FromBody] CreateCompetencyRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new CreateCompetencyCommand(request), cancellationToken));
    }

    [HttpPut("competencies/{id:guid}")]
    public async Task<ActionResult<ApiResponse<CompetencyDto>>> UpdateCompetency(Guid id, [FromBody] UpdateCompetencyRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new UpdateCompetencyCommand(id, request), cancellationToken));
    }

    [HttpPost("competencies/{id:guid}/archive")]
    public async Task<ActionResult<ApiResponse<CompetencyDto>>> ArchiveCompetency(Guid id, [FromBody] CompetencyVersionRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new ArchiveCompetencyCommand(id, request), cancellationToken));
    }

    [HttpDelete("competencies/{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteCompetency(Guid id, [FromBody] CompetencyVersionRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new DeleteCompetencyCommand(id, request), cancellationToken));
    }
}
