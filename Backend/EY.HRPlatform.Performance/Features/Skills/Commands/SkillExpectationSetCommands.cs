using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities.Skills;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
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

public sealed record CreateSkillExpectationSetCommand(
    ClaimsPrincipal Actor,
    string Name,
    string? Description,
    Guid ProficiencyScaleId,
    IReadOnlyList<SkillExpectationItemInput> Items)
    : ICommand<Result<SkillExpectationSetDto>>;

public sealed record UpdateSkillExpectationSetCommand(
    ClaimsPrincipal Actor,
    Guid SetId,
    string Name,
    string? Description,
    IReadOnlyList<SkillExpectationItemInput> Items)
    : ICommand<Result<SkillExpectationSetDto>>;

public sealed record SetSkillExpectationSetStatusCommand(
    ClaimsPrincipal Actor,
    Guid SetId,
    EvaluationConfigStatus TargetStatus)
    : ICommand<Result<SkillExpectationSetDto>>;

public sealed record DuplicateSkillExpectationSetCommand(
    ClaimsPrincipal Actor,
    Guid SetId,
    string Name)
    : ICommand<Result<SkillExpectationSetDto>>;

public sealed class CreateSkillExpectationSetCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<CreateSkillExpectationSetCommand, Result<SkillExpectationSetDto>>
{
    public async Task<Result<SkillExpectationSetDto>> Handle(
        CreateSkillExpectationSetCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(command.Actor))
            return SkillsConfigurationErrors.Forbidden<SkillExpectationSetDto>();

        var scale = await db.ProficiencyScales
            .Include(item => item.Levels)
            .SingleOrDefaultAsync(item => item.Id == command.ProficiencyScaleId, cancellationToken);
        if (scale is null)
            return Result.Failure<SkillExpectationSetDto>(Error.NotFound("ProficiencyScale", command.ProficiencyScaleId));

        var skillGuard = await SkillExpectationSetSupport.ValidateSkillsAsync(db, command.Items, cancellationToken);
        if (skillGuard.IsFailure)
            return Result.Failure<SkillExpectationSetDto>(skillGuard.Error);

        try
        {
            var set = SkillExpectationSet.CreateDraft(
                tenant.TenantId, command.Name, command.Description, command.ProficiencyScaleId);
            foreach (var input in command.Items)
                set.AddItem(input.SkillId, input.ExpectedLevelOrdinal, scale);

            db.SkillExpectationSets.Add(set);
            await SkillsConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "SkillExpectationSetCreated",
                nameof(SkillExpectationSet), set.Id, newValue: set.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return await SkillExpectationSetSupport.MapAsync(db, set, scale, cancellationToken);
        }
        catch (DbUpdateException)
        {
            return SkillsConfigurationErrors.NameConflict<SkillExpectationSetDto>("expectation set");
        }
        catch (Exception ex) when (SkillsConfigurationErrors.IsUserCorrectable(ex))
        {
            return SkillsConfigurationErrors.Invalid<SkillExpectationSetDto>(ex);
        }
    }
}

public sealed class UpdateSkillExpectationSetCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<UpdateSkillExpectationSetCommand, Result<SkillExpectationSetDto>>
{
    public async Task<Result<SkillExpectationSetDto>> Handle(
        UpdateSkillExpectationSetCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(command.Actor))
            return SkillsConfigurationErrors.Forbidden<SkillExpectationSetDto>();

        var set = await db.SkillExpectationSets
            .Include(item => item.Items)
            .SingleOrDefaultAsync(item => item.Id == command.SetId, cancellationToken);
        if (set is null)
            return Result.Failure<SkillExpectationSetDto>(Error.NotFound("SkillExpectationSet", command.SetId));

        var scale = await db.ProficiencyScales
            .Include(item => item.Levels)
            .SingleOrDefaultAsync(item => item.Id == set.ProficiencyScaleId, cancellationToken);
        if (scale is null)
            return Result.Failure<SkillExpectationSetDto>(Error.NotFound("ProficiencyScale", set.ProficiencyScaleId));

        var skillGuard = await SkillExpectationSetSupport.ValidateSkillsAsync(db, command.Items, cancellationToken);
        if (skillGuard.IsFailure)
            return Result.Failure<SkillExpectationSetDto>(skillGuard.Error);

        try
        {
            set.UpdateDetails(command.Name, command.Description);
            SynchronizeItems(set, command.Items, scale);
            await SkillsConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "SkillExpectationSetUpdated",
                nameof(SkillExpectationSet), set.Id, newValue: set.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return await SkillExpectationSetSupport.MapAsync(db, set, scale, cancellationToken);
        }
        catch (DbUpdateException)
        {
            return SkillsConfigurationErrors.NameConflict<SkillExpectationSetDto>("expectation set");
        }
        catch (Exception ex) when (SkillsConfigurationErrors.IsUserCorrectable(ex))
        {
            return SkillsConfigurationErrors.Invalid<SkillExpectationSetDto>(ex);
        }
    }

    private static void SynchronizeItems(
        SkillExpectationSet set,
        IReadOnlyList<SkillExpectationItemInput> requested,
        ProficiencyScale scale)
    {
        if (requested.Select(item => item.SkillId).Distinct().Count() != requested.Count)
            throw new DomainRuleViolationException("A skill can appear in an expectation set only once.");

        var requestedBySkill = requested.ToDictionary(item => item.SkillId);
        var existingBySkill = set.Items.ToDictionary(item => item.SkillId, item => item);

        foreach (var (skillId, item) in existingBySkill)
        {
            if (!requestedBySkill.ContainsKey(skillId))
                set.RemoveItem(item.Id);
            else if (requestedBySkill[skillId].ExpectedLevelOrdinal != item.ExpectedLevelOrdinal)
                set.UpdateItemExpectedLevel(item.Id, requestedBySkill[skillId].ExpectedLevelOrdinal, scale);
        }

        foreach (var input in requested.Where(input => !existingBySkill.ContainsKey(input.SkillId)))
            set.AddItem(input.SkillId, input.ExpectedLevelOrdinal, scale);
    }
}

public sealed class SetSkillExpectationSetStatusCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<SetSkillExpectationSetStatusCommand, Result<SkillExpectationSetDto>>
{
    public async Task<Result<SkillExpectationSetDto>> Handle(
        SetSkillExpectationSetStatusCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(command.Actor))
            return SkillsConfigurationErrors.Forbidden<SkillExpectationSetDto>();

        var set = await db.SkillExpectationSets
            .Include(item => item.Items)
            .SingleOrDefaultAsync(item => item.Id == command.SetId, cancellationToken);
        if (set is null)
            return Result.Failure<SkillExpectationSetDto>(Error.NotFound("SkillExpectationSet", command.SetId));

        var scale = await db.ProficiencyScales
            .Include(item => item.Levels)
            .SingleOrDefaultAsync(item => item.Id == set.ProficiencyScaleId, cancellationToken);
        if (scale is null)
            return Result.Failure<SkillExpectationSetDto>(Error.NotFound("ProficiencyScale", set.ProficiencyScaleId));

        try
        {
            if (command.TargetStatus == EvaluationConfigStatus.Active)
                set.Activate(scale);
            else if (command.TargetStatus == EvaluationConfigStatus.Archived)
                set.Archive();
            else
                throw new DomainRuleViolationException("An expectation set can only be activated or archived.");

            await SkillsConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, $"SkillExpectationSet{command.TargetStatus}",
                nameof(SkillExpectationSet), set.Id, newValue: command.TargetStatus.ToString(),
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return await SkillExpectationSetSupport.MapAsync(db, set, scale, cancellationToken);
        }
        catch (DbUpdateException)
        {
            return SkillsConfigurationErrors.NameConflict<SkillExpectationSetDto>("expectation set");
        }
        catch (Exception ex) when (SkillsConfigurationErrors.IsUserCorrectable(ex))
        {
            return SkillsConfigurationErrors.Invalid<SkillExpectationSetDto>(ex);
        }
    }
}

public sealed class DuplicateSkillExpectationSetCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<DuplicateSkillExpectationSetCommand, Result<SkillExpectationSetDto>>
{
    public async Task<Result<SkillExpectationSetDto>> Handle(
        DuplicateSkillExpectationSetCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(command.Actor))
            return SkillsConfigurationErrors.Forbidden<SkillExpectationSetDto>();

        var source = await db.SkillExpectationSets
            .AsNoTracking()
            .Include(item => item.Items)
            .SingleOrDefaultAsync(item => item.Id == command.SetId, cancellationToken);
        if (source is null)
            return Result.Failure<SkillExpectationSetDto>(Error.NotFound("SkillExpectationSet", command.SetId));

        var scale = await db.ProficiencyScales
            .Include(item => item.Levels)
            .SingleOrDefaultAsync(item => item.Id == source.ProficiencyScaleId, cancellationToken);
        if (scale is null)
            return Result.Failure<SkillExpectationSetDto>(Error.NotFound("ProficiencyScale", source.ProficiencyScaleId));

        try
        {
            var copy = source.Duplicate(command.Name);
            db.SkillExpectationSets.Add(copy);
            await SkillsConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "SkillExpectationSetDuplicated",
                nameof(SkillExpectationSet), copy.Id, previousValue: source.Id.ToString(), newValue: copy.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return await SkillExpectationSetSupport.MapAsync(db, copy, scale, cancellationToken);
        }
        catch (Exception ex) when (SkillsConfigurationErrors.IsUserCorrectable(ex))
        {
            return SkillsConfigurationErrors.Invalid<SkillExpectationSetDto>(ex);
        }
    }
}

internal static class SkillExpectationSetSupport
{
    /// <summary>
    /// Every referenced skill must be an active, tenant-owned skill. The tenant query filter
    /// already scopes the lookup, so a foreign or missing id simply fails the count check.
    /// </summary>
    public static async Task<Result> ValidateSkillsAsync(
        PerformanceDbContext db,
        IReadOnlyList<SkillExpectationItemInput> items,
        CancellationToken cancellationToken)
    {
        var skillIds = items.Select(item => item.SkillId).Distinct().ToArray();
        if (skillIds.Length == 0)
            return Result.Success();

        var activeIds = await db.Skills
            .Where(skill => skillIds.Contains(skill.Id) && skill.Status == SkillLifecycleStatus.Active)
            .Select(skill => skill.Id)
            .ToListAsync(cancellationToken);
        if (activeIds.Count != skillIds.Length)
            return Result.Failure(Error.Validation(
                "Skills.InvalidExpectationItem",
                "Every expectation item must reference an active skill in this tenant."));

        return Result.Success();
    }

    public static async Task<SkillExpectationSetDto> MapAsync(
        PerformanceDbContext db,
        SkillExpectationSet set,
        ProficiencyScale scale,
        CancellationToken cancellationToken)
    {
        var skillIds = set.Items.Select(item => item.SkillId).Distinct().ToArray();
        var skillLookup = await SkillsConfigurationQuerySupport.BuildSkillLookupAsync(db, skillIds, cancellationToken);
        var levelLabels = scale.Levels.ToDictionary(level => level.Ordinal, level => level.Label);
        return SkillsConfigurationMapper.ToDto(set, scale.Name, skillLookup, levelLabels);
    }
}
