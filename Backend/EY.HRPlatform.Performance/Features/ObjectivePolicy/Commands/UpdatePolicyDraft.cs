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

public sealed record UpdatePolicyDraftCommand(
    ClaimsPrincipal Actor,
    UpdatePolicyDraftRequest Request) : ICommand<Result<PolicyVersionDto>>;

public sealed class UpdatePolicyDraftCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenantContext,
    IConfigurationAuditWriter audit)
    : ICommandHandler<UpdatePolicyDraftCommand, Result<PolicyVersionDto>>
{
    public async Task<Result<PolicyVersionDto>> Handle(
        UpdatePolicyDraftCommand command,
        CancellationToken cancellationToken)
    {
        var req = command.Request;

        var draft = await db.TenantObjectivePolicyVersions
            .FirstOrDefaultAsync(v => v.Status == Domain.Entities.PolicyVersionStatus.Draft, cancellationToken);

        if (draft is null)
            return Result.Failure<PolicyVersionDto>(
                new Error("ObjectivePolicy.DraftNotFound", "No Draft policy version exists to update."));

        if (draft.Version != req.ExpectedVersion)
            return Result.Failure<PolicyVersionDto>(
                Error.Conflict("ObjectivePolicy.ConcurrencyConflict",
                    "The policy Draft was modified by another request. Reload and retry."));

        draft.UpdateDraft(
            req.MaxObjectivesPerPlan,
            req.AllowedWeightValues,
            req.ManagerValidationSlaDays,
            req.CascadeMode,
            req.MeasurementTypes,
            req.AttachmentsEnabled);

        await audit.AppendTenantAsync(
            tenantContext.TenantId,
            command.Actor.GetUserId(), command.Actor.GetFullName(),
            "PolicyDraftUpdated", "TenantObjectivePolicyVersion", draft.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return GetPolicyQueryHandler.ToDto(draft);
    }
}
