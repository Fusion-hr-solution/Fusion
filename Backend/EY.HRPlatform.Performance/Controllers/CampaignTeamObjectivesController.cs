using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.TeamObjectives.Commands;
using EY.HRPlatform.Performance.Features.TeamObjectives.Dtos;
using EY.HRPlatform.Performance.Features.TeamObjectives.Queries;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// Manager team-objective authoring inside launched campaigns. Capability permission is checked
/// here; frozen-baseline responsibility and ownership are enforced in the handlers.
/// </summary>
[ApiController]
[Route("api/performance/team-objectives")]
[Authorize]
public sealed class CampaignTeamObjectivesController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : PerformanceControllerBase
{
    [HttpGet("my-campaigns")]
    public async Task<IActionResult> GetMyCampaigns(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageTeamObjectives(User))
            return Denied();

        var result = await sender.Send(new GetMyTeamObjectiveCampaignsQuery(), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<IReadOnlyList<MyTeamObjectiveCampaignDto>>.Success(result.Value));
    }

    [HttpGet("campaigns/{slug}")]
    public async Task<IActionResult> GetWorkspace(string slug, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageTeamObjectives(User))
            return Denied();

        var result = await sender.Send(new GetTeamObjectiveWorkspaceQuery(slug), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<TeamObjectiveWorkspaceDto>.Success(result.Value));
    }

    [HttpPost("campaigns/{cycleId:guid}/objectives")]
    public async Task<IActionResult> Create(
        Guid cycleId,
        [FromBody] UpsertTeamObjectiveRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageTeamObjectives(User))
            return Denied();

        var result = await sender.Send(new CreateTeamObjectiveCommand(
            cycleId,
            request.StrategicObjectiveId,
            request.Title,
            request.SuccessCriteria,
            request.MeasurementMethod,
            request.Description), cancellationToken);

        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<TeamObjectiveDto>.Success(result.Value));
    }

    [HttpPut("campaigns/{cycleId:guid}/objectives/{objectiveId:guid}")]
    public async Task<IActionResult> Update(
        Guid cycleId,
        Guid objectiveId,
        [FromBody] UpsertTeamObjectiveRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageTeamObjectives(User))
            return Denied();
        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var result = await sender.Send(new UpdateTeamObjectiveCommand(
            cycleId,
            objectiveId,
            expectedVersion,
            request.StrategicObjectiveId,
            request.Title,
            request.SuccessCriteria,
            request.MeasurementMethod,
            request.Description), cancellationToken);

        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<TeamObjectiveDto>.Success(result.Value));
    }

    [HttpDelete("campaigns/{cycleId:guid}/objectives/{objectiveId:guid}")]
    public async Task<IActionResult> Delete(
        Guid cycleId,
        Guid objectiveId,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageTeamObjectives(User))
            return Denied();
        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var result = await sender.Send(
            new DeleteTeamObjectiveCommand(cycleId, objectiveId, expectedVersion), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : NoContent();
    }

    private IActionResult MapFailure(Error error) => Problem(error);

    private IActionResult PreconditionRequired()
        => MissingPrecondition();

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
