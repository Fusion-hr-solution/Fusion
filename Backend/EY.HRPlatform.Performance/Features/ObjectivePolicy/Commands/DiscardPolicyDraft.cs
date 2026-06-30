using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.ObjectivePolicy.Commands;

public sealed record DiscardPolicyDraftCommand(ClaimsPrincipal Actor) : ICommand<Result>;

public sealed class DiscardPolicyDraftCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenantContext,
    IConfigurationAuditWriter audit)
    : ICommandHandler<DiscardPolicyDraftCommand, Result>
{
    public async Task<Result> Handle(
        DiscardPolicyDraftCommand command,
        CancellationToken cancellationToken)
    {
        var policy = await db.TenantObjectivePolicies
            .Include(p => p.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (policy is null || policy.Draft is null)
            return Result.Failure(
                new Error("ObjectivePolicy.DraftNotFound", "No Draft policy version exists to discard."));

        var draftId = policy.Draft.Id;
        policy.DiscardDraft();

        await audit.AppendTenantAsync(
            tenantContext.TenantId,
            command.Actor.GetUserId(), command.Actor.GetFullName(),
            "PolicyDraftDiscarded", "TenantObjectivePolicyVersion", draftId,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
