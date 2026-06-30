using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Provisioning;

public sealed record ProvisionTenantResult(bool WasAlreadyProvisioned, Guid PolicyId);

public sealed record ProvisionTenantCommand(Guid TenantId) : ICommand<Result<ProvisionTenantResult>>;

public sealed class ProvisionTenantCommandHandler(PerformanceDbContext db)
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
            .Select(p => new { p.Id })
            .FirstOrDefaultAsync(cancellationToken);

        if (existing is not null)
            return Result.Success(new ProvisionTenantResult(true, existing.Id));

        // Get the published baseline.
        var baseline = await db.PlatformObjectiveBaselines
            .AsNoTracking()
            .Include(b => b.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (baseline?.PublishedVersion is null)
            return Result.Failure<ProvisionTenantResult>(new Error(
                "Provisioning.NoPublishedBaseline",
                "No published performance baseline exists. Publish a baseline before provisioning tenants."));

        var published = baseline.PublishedVersion;

        // Create tenant policy.
        var policy = TenantObjectivePolicy.Create(tenantId);
        policy.ProvisionFromBaseline(
            published.MaxObjectivesPerPlan,
            published.AllowedWeightValues,
            published.ManagerValidationSlaDays,
            published.CascadeMode,
            published.MeasurementTypes,
            published.AttachmentsEnabled,
            published.Id);

        db.TenantObjectivePolicies.Add(policy);

        // Copy active platform starter templates to the tenant.
        var starterTemplates = await db.PlatformStarterTemplates
            .AsNoTracking()
            .Where(t => t.IsActive)
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Title)
            .ToListAsync(cancellationToken);

        foreach (var starter in starterTemplates)
        {
            var container = ObjectiveTemplate.Create(tenantId);
            var revision = container.CreateDraftRevision(
                starter.Title,
                starter.Description,
                null,
                starter.MeasurementType,
                starter.SuggestedWeighting,
                starter.Tags,
                starter.TargetValue,
                starter.Unit,
                starter.SuccessCriteria,
                tenantId.ToString(),
                "System",
                null);

            revision.SetApplicabilityValidationState("Valid");
            container.ActivateRevision(tenantId.ToString(), "System", "Provisioned from platform starter pack");
            db.ObjectiveTemplateContainers.Add(container);
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success(new ProvisionTenantResult(false, policy.Id));
    }
}
