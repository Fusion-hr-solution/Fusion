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

public sealed record CreateSkillCategoryCommand(ClaimsPrincipal Actor, string Name)
    : ICommand<Result<SkillCategoryDto>>;

public sealed record UpdateSkillCategoryCommand(ClaimsPrincipal Actor, Guid CategoryId, string Name)
    : ICommand<Result<SkillCategoryDto>>;

public sealed record ArchiveSkillCategoryCommand(ClaimsPrincipal Actor, Guid CategoryId)
    : ICommand<Result<SkillCategoryDto>>;

public sealed class CreateSkillCategoryCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<CreateSkillCategoryCommand, Result<SkillCategoryDto>>
{
    public async Task<Result<SkillCategoryDto>> Handle(
        CreateSkillCategoryCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(command.Actor))
            return SkillsConfigurationErrors.Forbidden<SkillCategoryDto>();

        try
        {
            var category = SkillCategory.Create(tenant.TenantId, command.Name);
            db.SkillCategories.Add(category);
            await SkillsConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "SkillCategoryCreated",
                nameof(SkillCategory), category.Id, newValue: category.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return SkillsConfigurationMapper.ToDto(category, 0);
        }
        catch (DbUpdateException)
        {
            return SkillsConfigurationErrors.NameConflict<SkillCategoryDto>("skill category");
        }
        catch (Exception ex) when (SkillsConfigurationErrors.IsUserCorrectable(ex))
        {
            return SkillsConfigurationErrors.Invalid<SkillCategoryDto>(ex);
        }
    }
}

public sealed class UpdateSkillCategoryCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<UpdateSkillCategoryCommand, Result<SkillCategoryDto>>
{
    public async Task<Result<SkillCategoryDto>> Handle(
        UpdateSkillCategoryCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(command.Actor))
            return SkillsConfigurationErrors.Forbidden<SkillCategoryDto>();

        var category = await db.SkillCategories
            .SingleOrDefaultAsync(item => item.Id == command.CategoryId, cancellationToken);
        if (category is null)
            return Result.Failure<SkillCategoryDto>(Error.NotFound("SkillCategory", command.CategoryId));

        try
        {
            category.Rename(command.Name);
            await SkillsConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "SkillCategoryUpdated",
                nameof(SkillCategory), category.Id, newValue: category.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            var activeSkillCount = await CountActiveSkillsAsync(db, category.Id, cancellationToken);
            return SkillsConfigurationMapper.ToDto(category, activeSkillCount);
        }
        catch (DbUpdateException)
        {
            return SkillsConfigurationErrors.NameConflict<SkillCategoryDto>("skill category");
        }
        catch (Exception ex) when (SkillsConfigurationErrors.IsUserCorrectable(ex))
        {
            return SkillsConfigurationErrors.Invalid<SkillCategoryDto>(ex);
        }
    }

    internal static Task<int> CountActiveSkillsAsync(
        PerformanceDbContext db, Guid categoryId, CancellationToken cancellationToken) =>
        db.Skills.CountAsync(
            skill => skill.SkillCategoryId == categoryId && skill.Status == SkillLifecycleStatus.Active,
            cancellationToken);
}

public sealed class ArchiveSkillCategoryCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<ArchiveSkillCategoryCommand, Result<SkillCategoryDto>>
{
    public async Task<Result<SkillCategoryDto>> Handle(
        ArchiveSkillCategoryCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(command.Actor))
            return SkillsConfigurationErrors.Forbidden<SkillCategoryDto>();

        var category = await db.SkillCategories
            .SingleOrDefaultAsync(item => item.Id == command.CategoryId, cancellationToken);
        if (category is null)
            return Result.Failure<SkillCategoryDto>(Error.NotFound("SkillCategory", command.CategoryId));

        // A category with active skills cannot be archived until its skills are archived or moved.
        var blockingSkills = await db.Skills
            .Where(skill => skill.SkillCategoryId == category.Id && skill.Status == SkillLifecycleStatus.Active)
            .Select(skill => skill.Name)
            .OrderBy(name => name)
            .ToListAsync(cancellationToken);
        if (blockingSkills.Count > 0)
            return Result.Failure<SkillCategoryDto>(Error.Conflict(
                "Skills.CategoryHasActiveSkillsConflict",
                $"Archive or recategorize these active skills first: {string.Join(", ", blockingSkills)}."));

        try
        {
            category.Archive();
            await SkillsConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "SkillCategoryArchived",
                nameof(SkillCategory), category.Id, newValue: category.Status.ToString(),
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return SkillsConfigurationMapper.ToDto(category, 0);
        }
        catch (Exception ex) when (SkillsConfigurationErrors.IsUserCorrectable(ex))
        {
            return SkillsConfigurationErrors.Invalid<SkillCategoryDto>(ex);
        }
    }
}
