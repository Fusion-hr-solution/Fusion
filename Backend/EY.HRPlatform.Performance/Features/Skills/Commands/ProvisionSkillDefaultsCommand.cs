using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Defaults;
using EY.HRPlatform.Performance.Domain.Entities.Skills;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Skills.Dtos;
using EY.HRPlatform.Performance.Features.Skills.Queries;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Skills.Commands;

/// <summary>
/// Explicit, idempotent instantiation of the tenant-owned product defaults (proficiency scale,
/// categories, starter skills, starter expectation set). Reads never provision — the workspace
/// surfaces this command as its empty-state action. Returns the refreshed workspace.
/// </summary>
public sealed record ProvisionSkillDefaultsCommand(ClaimsPrincipal Actor)
    : ICommand<Result<SkillsConfigurationWorkspaceDto>>;

public sealed class ProvisionSkillDefaultsCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<ProvisionSkillDefaultsCommand, Result<SkillsConfigurationWorkspaceDto>>
{
    public async Task<Result<SkillsConfigurationWorkspaceDto>> Handle(
        ProvisionSkillDefaultsCommand command, CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(command.Actor))
            return SkillsConfigurationErrors.Forbidden<SkillsConfigurationWorkspaceDto>();

        var alreadyProvisioned = await db.ProficiencyScales.AnyAsync(cancellationToken)
            || await db.SkillCategories.AnyAsync(cancellationToken)
            || await db.SkillExpectationSets.AnyAsync(cancellationToken);

        if (!alreadyProvisioned)
        {
            var tenantId = tenant.TenantId;
            var defaults = SkillConfigurationDefaults.InstantiateForTenant(tenantId);
            db.ProficiencyScales.Add(defaults.ProficiencyScale);
            db.SkillCategories.AddRange(defaults.Categories);
            db.Skills.AddRange(defaults.Skills);
            db.SkillExpectationSets.Add(defaults.ExpectationSet);

            await audit.AppendTenantAsync(
                tenantId, Guid.Empty, "Performance provisioning",
                "SkillConfigurationDefaultsProvisioned", nameof(SkillExpectationSet),
                defaults.ExpectationSet.Id, newValue: defaults.ExpectationSet.Name,
                cancellationToken: cancellationToken);

            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                // A concurrent provision won the unique-index race; discard our unsaved copies.
                foreach (var entry in db.ChangeTracker.Entries().Where(e => e.State == EntityState.Added).ToList())
                    entry.State = EntityState.Detached;
            }
        }

        return await new GetSkillsConfigurationWorkspaceQueryHandler(db, access)
            .Handle(new GetSkillsConfigurationWorkspaceQuery(command.Actor), cancellationToken);
    }
}
