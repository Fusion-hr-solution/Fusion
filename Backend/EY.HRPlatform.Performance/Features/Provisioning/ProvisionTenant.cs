using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Provisioning;

public sealed record ProvisionTenantResult(
    bool WasAlreadyProvisioned,
    Guid PolicyId,
    Guid ConfigurationVersionId);

public sealed record ProvisionTenantCommand(Guid TenantId) : ICommand<Result<ProvisionTenantResult>>;

public sealed class ProvisionTenantCommandHandler(PerformanceDbContext db, TenantContext tenantContext)
    : ICommandHandler<ProvisionTenantCommand, Result<ProvisionTenantResult>>
{
    public async Task<Result<ProvisionTenantResult>> Handle(
        ProvisionTenantCommand command,
        CancellationToken cancellationToken)
    {
        var tenantId = command.TenantId;

        // Idempotent: if tenant already has a policy with an active version, return existing.
        var existing = await db.TenantObjectivePolicies
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId)
            .Select(p => new
            {
                p.Id,
                VersionId = p.Versions
                    .Where(v => v.Status == Domain.Entities.ObjectivePlanningConfigurationVersionStatus.Current)
                    .Select(v => v.Id)
                    .FirstOrDefault()
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (existing is not null)
            return Result.Success(new ProvisionTenantResult(true, existing.Id, existing.VersionId));

        // Get the applied platform starting configuration used for new tenants.
        var baseline = await db.PlatformObjectiveBaselines
            .AsNoTracking()
            .Include(b => b.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (baseline?.CurrentVersion is null)
            return Result.Failure<ProvisionTenantResult>(new Error(
                "Provisioning.NoStartingConfiguration",
                "No platform starting configuration exists. Apply platform performance configuration before provisioning tenants."));

        var startingConfiguration = baseline.CurrentVersion;

        // This is a signed service-to-service call with no ambient tenant context. Establish the
        // target tenant so the fail-closed tenant interceptor accepts the new tenant-owned policy.
        if (!tenantContext.IsResolved)
            tenantContext.SetTenant(tenantId);

        // Create tenant policy.
        var policy = TenantObjectivePolicy.Create(tenantId);
        var version = policy.ProvisionFromStartingConfiguration(
            startingConfiguration.MaxObjectivesPerPlan,
            startingConfiguration.AllowedWeightValues,
            startingConfiguration.MeasurementTypes,
            startingConfiguration.Id);

        db.TenantObjectivePolicies.Add(policy);

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success(new ProvisionTenantResult(false, policy.Id, version.Id));
    }
}
