using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities.Skills;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Skills.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Skills.Commands;

public sealed record CreateSkillCommand(
    ClaimsPrincipal Actor,
    string Name,
    string? Description,
    Guid CategoryId)
    : ICommand<Result<SkillDto>>;

public sealed record UpdateSkillCommand(
    ClaimsPrincipal Actor,
    Guid SkillId,
    string Name,
    string? Description,
    Guid CategoryId)
    : ICommand<Result<SkillDto>>;

public sealed record ArchiveSkillCommand(ClaimsPrincipal Actor, Guid SkillId)
    : ICommand<Result<SkillDto>>;

public sealed class CreateSkillCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<CreateSkillCommand, Result<SkillDto>>
{
    public async Task<Result<SkillDto>> Handle(CreateSkillCommand command, CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(command.Actor))
            return SkillsConfigurationErrors.Forbidden<SkillDto>();

        var category = await db.SkillCategories
            .SingleOrDefaultAsync(item => item.Id == command.CategoryId, cancellationToken);
        if (category is null)
            return Result.Failure<SkillDto>(Error.NotFound("SkillCategory", command.CategoryId));
        if (category.Status != SkillLifecycleStatus.Active)
            return SkillsConfigurationErrors.Invalid<SkillDto>(
                new InvalidOperationException("A skill cannot be added to an archived category."));

        if (await SkillsConfigurationNames.SkillTakenAsync(db, command.Name, null, cancellationToken))
            return SkillsConfigurationErrors.NameConflict<SkillDto>("skill");

        try
        {
            var skill = Skill.Create(tenant.TenantId, command.Name, command.Description, command.CategoryId);
            db.Skills.Add(skill);
            await SkillsConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "SkillCreated",
                nameof(Skill), skill.Id, newValue: skill.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return Map(skill, category.Name);
        }
        catch (DbUpdateException)
        {
            return SkillsConfigurationErrors.NameConflict<SkillDto>("skill");
        }
        catch (Exception ex) when (SkillsConfigurationErrors.IsUserCorrectable(ex))
        {
            return SkillsConfigurationErrors.Invalid<SkillDto>(ex);
        }
    }

    private static SkillDto Map(Skill skill, string categoryName) =>
        SkillsConfigurationMapper.ToDto(skill, new Dictionary<Guid, string> { [skill.SkillCategoryId] = categoryName });
}

public sealed class UpdateSkillCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<UpdateSkillCommand, Result<SkillDto>>
{
    public async Task<Result<SkillDto>> Handle(UpdateSkillCommand command, CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(command.Actor))
            return SkillsConfigurationErrors.Forbidden<SkillDto>();

        var skill = await db.Skills
            .SingleOrDefaultAsync(item => item.Id == command.SkillId, cancellationToken);
        if (skill is null)
            return Result.Failure<SkillDto>(Error.NotFound("Skill", command.SkillId));

        var category = await db.SkillCategories
            .SingleOrDefaultAsync(item => item.Id == command.CategoryId, cancellationToken);
        if (category is null)
            return Result.Failure<SkillDto>(Error.NotFound("SkillCategory", command.CategoryId));
        if (category.Status != SkillLifecycleStatus.Active)
            return SkillsConfigurationErrors.Invalid<SkillDto>(
                new InvalidOperationException("A skill cannot be moved into an archived category."));

        if (await SkillsConfigurationNames.SkillTakenAsync(db, command.Name, skill.Id, cancellationToken))
            return SkillsConfigurationErrors.NameConflict<SkillDto>("skill");

        try
        {
            skill.Update(command.Name, command.Description, command.CategoryId);
            await SkillsConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "SkillUpdated",
                nameof(Skill), skill.Id, newValue: skill.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return SkillsConfigurationMapper.ToDto(
                skill, new Dictionary<Guid, string> { [skill.SkillCategoryId] = category.Name });
        }
        catch (DbUpdateException)
        {
            return SkillsConfigurationErrors.NameConflict<SkillDto>("skill");
        }
        catch (Exception ex) when (SkillsConfigurationErrors.IsUserCorrectable(ex))
        {
            return SkillsConfigurationErrors.Invalid<SkillDto>(ex);
        }
    }
}

public sealed class ArchiveSkillCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<ArchiveSkillCommand, Result<SkillDto>>
{
    public async Task<Result<SkillDto>> Handle(ArchiveSkillCommand command, CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(command.Actor))
            return SkillsConfigurationErrors.Forbidden<SkillDto>();

        var skill = await db.Skills
            .SingleOrDefaultAsync(item => item.Id == command.SkillId, cancellationToken);
        if (skill is null)
            return Result.Failure<SkillDto>(Error.NotFound("Skill", command.SkillId));

        try
        {
            skill.Archive();
            await SkillsConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "SkillArchived",
                nameof(Skill), skill.Id, newValue: skill.Status.ToString(),
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            var categoryName = await db.SkillCategories
                .Where(category => category.Id == skill.SkillCategoryId)
                .Select(category => category.Name)
                .SingleOrDefaultAsync(cancellationToken) ?? string.Empty;
            return SkillsConfigurationMapper.ToDto(
                skill, new Dictionary<Guid, string> { [skill.SkillCategoryId] = categoryName });
        }
        catch (Exception ex) when (SkillsConfigurationErrors.IsUserCorrectable(ex))
        {
            return SkillsConfigurationErrors.Invalid<SkillDto>(ex);
        }
    }
}
