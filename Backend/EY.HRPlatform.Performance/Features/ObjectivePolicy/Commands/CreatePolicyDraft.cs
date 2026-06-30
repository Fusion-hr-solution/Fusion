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

public sealed record CreatePolicyDraftCommand(
    ClaimsPrincipal Actor,
    CreatePolicyDraftRequest Request) : ICommand<Result<PolicyVersionDto>>;

public sealed class CreatePolicyDraftCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenantContext,
    IConfigurationAuditWriter audit)
    : ICommandHandler<CreatePolicyDraftCommand, Result<PolicyVersionDto>>
{
    public async Task<Result<PolicyVersionDto>> Handle(
        CreatePolicyDraftCommand command,
        CancellationToken cancellationToken)
    {
        var actorId = command.Actor.GetUserId();
        var actorName = command.Actor.GetFullName();
        var req = command.Request;

        // Get or create the tenant policy container
        var policy = await db.TenantObjectivePolicies
            .Include(p => p.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (policy is null)
        {
            policy = TenantObjectivePolicy.Create(tenantContext.TenantId);
            db.TenantObjectivePolicies.Add(policy);
            var initialDraft = policy.CreateDraft(
                req.MaxObjectivesPerPlan,
                req.AllowedWeightValues,
                req.ManagerValidationSlaDays,
                req.CascadeMode,
                req.MeasurementTypes,
                req.AttachmentsEnabled,
                actorId,
                actorName);

            await audit.AppendTenantAsync(
                tenantContext.TenantId,
                actorId, actorName,
                "PolicyDraftCreated", "TenantObjectivePolicyVersion", initialDraft.Id,
                cancellationToken: cancellationToken);

            await db.SaveChangesAsync(cancellationToken);
            return GetPolicyQueryHandler.ToDto(initialDraft);
        }

        if (policy.Draft is not null)
        {
            return Result.Failure<PolicyVersionDto>(
                Error.Conflict("ObjectivePolicy.DraftExists",
                    "A Draft policy version already exists. Discard or publish it before creating a new one."));
        }

        var draft = TenantObjectivePolicyVersion.Create(
            tenantContext.TenantId,
            policy.Id,
            policy.Versions.Count == 0 ? 1 : policy.Versions.Max(v => v.VersionNumber) + 1,
            req.MaxObjectivesPerPlan,
            req.AllowedWeightValues,
            req.ManagerValidationSlaDays,
            req.CascadeMode,
            req.MeasurementTypes,
            req.AttachmentsEnabled,
            actorId,
            actorName,
            policy.ActiveVersion?.Id,
            null);
        db.TenantObjectivePolicyVersions.Add(draft);

        await audit.AppendTenantAsync(
            tenantContext.TenantId,
            actorId, actorName,
            "PolicyDraftCreated", "TenantObjectivePolicyVersion", draft.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return GetPolicyQueryHandler.ToDto(draft);
    }
}
