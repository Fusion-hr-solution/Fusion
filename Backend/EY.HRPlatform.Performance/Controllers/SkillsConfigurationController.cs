using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Skills.Commands;
using EY.HRPlatform.Performance.Features.Skills.Dtos;
using EY.HRPlatform.Performance.Features.Skills.Queries;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/skills-config")]
[Authorize]
public sealed class SkillsConfigurationController(
    ISender sender,
    IPerformanceAccessPolicyService access) : PerformanceControllerBase
{
    // ─── Workspace (pure read) ───────────────────────────────────────────────

    [HttpGet("workspace")]
    public async Task<IActionResult> GetWorkspace(CancellationToken ct)
    {
        if (!access.CanManageSkills(User)) return Denied();
        return Respond(await sender.Send(new GetSkillsConfigurationWorkspaceQuery(User), ct));
    }

    // Explicit, idempotent tenant-defaults provisioning — the workspace empty-state action.
    [HttpPost("provision-defaults")]
    public async Task<IActionResult> ProvisionDefaults(CancellationToken ct)
    {
        if (!access.CanManageSkills(User)) return Denied();
        return Respond(await sender.Send(new ProvisionSkillDefaultsCommand(User), ct));
    }

    // Round-facing read of active sets — evaluation configuration permission, not skills.manage.
    [HttpGet("active-sets")]
    public async Task<IActionResult> ListActiveSetsForRound(CancellationToken ct)
    {
        if (!access.CanManageEvaluations(User)) return Denied();
        return Respond(await sender.Send(new ListActiveExpectationSetsForRoundQuery(User), ct));
    }

    // ─── Categories ──────────────────────────────────────────────────────────

    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory(SkillNameRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new CreateSkillCategoryCommand(User, request.Name), ct));

    [HttpPut("categories/{id:guid}")]
    public async Task<IActionResult> UpdateCategory(Guid id, SkillNameRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new UpdateSkillCategoryCommand(User, id, request.Name), ct));

    [HttpPost("categories/{id:guid}/archive")]
    public async Task<IActionResult> ArchiveCategory(Guid id, CancellationToken ct) =>
        Respond(await sender.Send(new ArchiveSkillCategoryCommand(User, id), ct));

    // ─── Skills ──────────────────────────────────────────────────────────────

    [HttpPost("skills")]
    public async Task<IActionResult> CreateSkill(SkillWriteRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new CreateSkillCommand(User, request.Name, request.Description, request.CategoryId), ct));

    [HttpPut("skills/{id:guid}")]
    public async Task<IActionResult> UpdateSkill(Guid id, SkillWriteRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new UpdateSkillCommand(User, id, request.Name, request.Description, request.CategoryId), ct));

    [HttpPost("skills/{id:guid}/archive")]
    public async Task<IActionResult> ArchiveSkill(Guid id, CancellationToken ct) =>
        Respond(await sender.Send(new ArchiveSkillCommand(User, id), ct));

    // ─── Proficiency scales ──────────────────────────────────────────────────

    [HttpPost("scales")]
    public async Task<IActionResult> CreateScale(ProficiencyScaleWriteRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new CreateProficiencyScaleCommand(User, request.Name, request.Description, request.Levels), ct));

    [HttpPut("scales/{id:guid}")]
    public async Task<IActionResult> UpdateScale(Guid id, ProficiencyScaleWriteRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new UpdateProficiencyScaleCommand(User, id, request.Name, request.Description, request.Levels), ct));

    [HttpPost("scales/{id:guid}/status")]
    public async Task<IActionResult> SetScaleStatus(Guid id, SkillStatusRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new SetProficiencyScaleStatusCommand(User, id, request.Status), ct));

    [HttpPost("scales/{id:guid}/duplicate")]
    public async Task<IActionResult> DuplicateScale(Guid id, SkillNameRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new DuplicateProficiencyScaleCommand(User, id, request.Name), ct));

    // ─── Expectation sets ────────────────────────────────────────────────────

    [HttpPost("sets")]
    public async Task<IActionResult> CreateSet(SkillExpectationSetWriteRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new CreateSkillExpectationSetCommand(
            User, request.Name, request.Description, request.ProficiencyScaleId, request.Items), ct));

    [HttpPut("sets/{id:guid}")]
    public async Task<IActionResult> UpdateSet(Guid id, SkillExpectationSetWriteRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new UpdateSkillExpectationSetCommand(
            User, id, request.Name, request.Description, request.Items), ct));

    [HttpPost("sets/{id:guid}/status")]
    public async Task<IActionResult> SetSetStatus(Guid id, SkillStatusRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new SetSkillExpectationSetStatusCommand(User, id, request.Status), ct));

    [HttpPost("sets/{id:guid}/duplicate")]
    public async Task<IActionResult> DuplicateSet(Guid id, SkillNameRequest request, CancellationToken ct) =>
        Respond(await sender.Send(new DuplicateSkillExpectationSetCommand(User, id, request.Name), ct));

    private IActionResult Respond<T>(Result<T> result) => result.IsSuccess
        ? Ok(ApiResponse<T>.Success(result.Value))
        : MapFailure(result.Error);

    private IActionResult MapFailure(Error error) => Problem(error);
}

public sealed record SkillNameRequest(string Name);
public sealed record SkillWriteRequest(string Name, string? Description, Guid CategoryId);
public sealed record ProficiencyScaleWriteRequest(
    string Name, string? Description, IReadOnlyList<ProficiencyScaleLevelInput> Levels);
public sealed record SkillExpectationSetWriteRequest(
    string Name, string? Description, Guid ProficiencyScaleId, IReadOnlyList<SkillExpectationItemInput> Items);
public sealed record SkillStatusRequest(EvaluationConfigStatus Status);
