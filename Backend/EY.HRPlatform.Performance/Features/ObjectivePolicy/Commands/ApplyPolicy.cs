using EY.HRPlatform.Performance.Domain.Entities;
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

public sealed record ApplyPolicyCommand(
    ClaimsPrincipal Actor,
    ApplyPolicyRequest Request,
    uint ExpectedCurrentVersion) : ICommand<Result<PolicyVersionDto>>;

public sealed class ApplyPolicyCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenantContext,
    IConfigurationAuditWriter audit,
    PolicyValidator validator,
    TemplateCompatibilityChecker compatibilityChecker)
    : ICommandHandler<ApplyPolicyCommand, Result<PolicyVersionDto>>
{
    public async Task<Result<PolicyVersionDto>> Handle(
        ApplyPolicyCommand command,
        CancellationToken cancellationToken)
    {
        var actorId = command.Actor.GetUserId();
        var actorName = command.Actor.GetFullName();
        var req = command.Request;

        var policy = await db.TenantObjectivePolicies
            .Include(p => p.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (policy is null || policy.ActiveVersion is null)
            return Result.Failure<PolicyVersionDto>(
                new Error("ObjectivePolicy.NotFound", "No current objective policy has been provisioned for this tenant."));

        var current = policy.ActiveVersion;
        if (current.Version != command.ExpectedCurrentVersion)
        {
            if (current.HasSamePolicyValues(
                    req.MaxObjectivesPerPlan,
                    req.AllowedWeightValues,
                    req.ManagerValidationSlaDays,
                    req.CascadeMode,
                    req.MeasurementTypes,
                    req.AttachmentsEnabled))
            {
                return GetPolicyQueryHandler.ToDto(current);
            }

            return Result.Failure<PolicyVersionDto>(
                Error.Conflict("ObjectivePolicy.StaleApply",
                    "The current policy changed. Review the latest policy before applying again."));
        }

        if (current.HasSamePolicyValues(
                req.MaxObjectivesPerPlan,
                req.AllowedWeightValues,
                req.ManagerValidationSlaDays,
                req.CascadeMode,
                req.MeasurementTypes,
                req.AttachmentsEnabled))
        {
            return GetPolicyQueryHandler.ToDto(current);
        }

        var candidate = TenantObjectivePolicyVersion.CreateApplied(
            tenantContext.TenantId,
            policy.Id,
            current.VersionNumber + 1,
            req.MaxObjectivesPerPlan,
            req.AllowedWeightValues,
            req.ManagerValidationSlaDays,
            req.CascadeMode,
            req.MeasurementTypes,
            req.AttachmentsEnabled,
            actorId,
            actorName,
            req.ChangeSummary,
            current.Id);

        var guardrails = await db.PlatformPerformanceGuardrails
            .FirstOrDefaultAsync(cancellationToken);

        if (guardrails is not null)
        {
            var validation = validator.Validate(candidate, guardrails);
            if (validation.IsFailure)
                return Result.Failure<PolicyVersionDto>(validation.Error);
        }

        var templateIssues = await compatibilityChecker.CheckAsync(candidate, cancellationToken);
        if (templateIssues.Count > 0)
        {
            var affected = string.Join("; ", templateIssues.Take(5).Select(i => $"{i.TemplateName}: {i.Reason}"));
            return Result.Failure<PolicyVersionDto>(
                Error.Conflict("ObjectivePolicy.TemplateCompatibilityConflict",
                    $"{templateIssues.Count} active template(s) would become invalid: {affected}"));
        }

        var applied = policy.ApplyPolicy(
            req.MaxObjectivesPerPlan,
            req.AllowedWeightValues,
            req.ManagerValidationSlaDays,
            req.CascadeMode,
            req.MeasurementTypes,
            req.AttachmentsEnabled,
            actorId,
            actorName,
            req.ChangeSummary);
        db.TenantObjectivePolicyVersions.Add(applied);

        await audit.AppendTenantAsync(
            tenantContext.TenantId,
            actorId, actorName,
            "PolicyApplied", "TenantObjectivePolicyVersion", applied.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return GetPolicyQueryHandler.ToDto(applied);
    }
}
