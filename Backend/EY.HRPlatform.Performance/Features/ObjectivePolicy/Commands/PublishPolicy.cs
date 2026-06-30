using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Dtos;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Queries;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.ObjectivePolicy.Commands;

public sealed record PublishPolicyCommand(
    ClaimsPrincipal Actor,
    PublishPolicyRequest Request) : ICommand<Result<PolicyVersionDto>>;

public sealed class PublishPolicyCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenantContext,
    IConfigurationAuditWriter audit,
    PolicyValidator validator,
    TemplateCompatibilityChecker compatibilityChecker)
    : ICommandHandler<PublishPolicyCommand, Result<PolicyVersionDto>>
{
    public async Task<Result<PolicyVersionDto>> Handle(
        PublishPolicyCommand command,
        CancellationToken cancellationToken)
    {
        var actorId = command.Actor.GetUserId();
        var actorName = command.Actor.GetFullName();
        var req = command.Request;

        var policy = await db.TenantObjectivePolicies
            .Include(p => p.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (policy is null || policy.Draft is null)
            return Result.Failure<PolicyVersionDto>(
                new Error("ObjectivePolicy.DraftNotFound", "No Draft policy version exists to publish."));

        if (policy.Draft.Version != req.ExpectedVersion)
            return Result.Failure<PolicyVersionDto>(
                Error.Conflict("ObjectivePolicy.ConcurrencyConflict",
                    "The policy Draft was modified by another request. Reload and retry."));

        // Validate against platform guardrails (published record only; draft not authoritative)
        var guardrails = await db.PlatformPerformanceGuardrails
            .FirstOrDefaultAsync(g => !g.IsDraft, cancellationToken);

        if (guardrails is not null)
        {
            var validation = validator.Validate(policy.Draft, guardrails);
            if (validation.IsFailure)
                return Result.Failure<PolicyVersionDto>(validation.Error);
        }

        // Template compatibility check
        var templateIssues = await compatibilityChecker.CheckAsync(policy.Draft, cancellationToken);
        if (templateIssues.Count > 0)
        {
            var affected = string.Join("; ", templateIssues.Take(5).Select(i => $"{i.TemplateName}: {i.Reason}"));
            return Result.Failure<PolicyVersionDto>(
                Error.Conflict("ObjectivePolicy.TemplateCompatibilityConflict",
                    $"{templateIssues.Count} active template(s) would become invalid: {affected}"));
        }

        policy.PublishDraft(actorId, actorName, req.ChangeSummary);

        await audit.AppendTenantAsync(
            tenantContext.TenantId,
            actorId, actorName,
            "PolicyPublished", "TenantObjectivePolicyVersion", policy.ActiveVersion!.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return GetPolicyQueryHandler.ToDto(policy.ActiveVersion!);
    }
}
