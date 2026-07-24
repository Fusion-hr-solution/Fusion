using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities.Skills;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Skills.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Skills.Commands;

public sealed record CreateProficiencyScaleCommand(
    ClaimsPrincipal Actor,
    string Name,
    string? Description,
    IReadOnlyList<ProficiencyScaleLevelInput> Levels)
    : ICommand<Result<ProficiencyScaleDto>>;

public sealed record UpdateProficiencyScaleCommand(
    ClaimsPrincipal Actor,
    Guid ScaleId,
    string Name,
    string? Description,
    IReadOnlyList<ProficiencyScaleLevelInput> Levels)
    : ICommand<Result<ProficiencyScaleDto>>;

public sealed record SetProficiencyScaleStatusCommand(
    ClaimsPrincipal Actor,
    Guid ScaleId,
    EvaluationConfigStatus TargetStatus)
    : ICommand<Result<ProficiencyScaleDto>>;

public sealed record DuplicateProficiencyScaleCommand(
    ClaimsPrincipal Actor,
    Guid ScaleId,
    string Name)
    : ICommand<Result<ProficiencyScaleDto>>;

public sealed class CreateProficiencyScaleCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<CreateProficiencyScaleCommand, Result<ProficiencyScaleDto>>
{
    public async Task<Result<ProficiencyScaleDto>> Handle(
        CreateProficiencyScaleCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(command.Actor))
            return SkillsConfigurationErrors.Forbidden<ProficiencyScaleDto>();

        try
        {
            var scale = ProficiencyScale.CreateDraft(
                tenant.TenantId,
                command.Name,
                command.Description,
                command.Levels.Select(level => new ProficiencyScaleLevelDraft(
                    level.Label, level.Description)).ToArray());

            db.ProficiencyScales.Add(scale);
            await SkillsConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "ProficiencyScaleCreated",
                nameof(ProficiencyScale), scale.Id, newValue: scale.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return SkillsConfigurationMapper.ToDto(scale);
        }
        catch (Exception ex) when (SkillsConfigurationErrors.IsUserCorrectable(ex))
        {
            return SkillsConfigurationErrors.Invalid<ProficiencyScaleDto>(ex);
        }
    }
}

public sealed class UpdateProficiencyScaleCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<UpdateProficiencyScaleCommand, Result<ProficiencyScaleDto>>
{
    public async Task<Result<ProficiencyScaleDto>> Handle(
        UpdateProficiencyScaleCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(command.Actor))
            return SkillsConfigurationErrors.Forbidden<ProficiencyScaleDto>();

        var scale = await db.ProficiencyScales
            .Include(item => item.Levels)
            .SingleOrDefaultAsync(item => item.Id == command.ScaleId, cancellationToken);
        if (scale is null)
            return Result.Failure<ProficiencyScaleDto>(Error.NotFound("ProficiencyScale", command.ScaleId));

        try
        {
            scale.UpdateDetails(command.Name, command.Description);
            SynchronizeLevels(scale, command.Levels);
            await SkillsConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "ProficiencyScaleUpdated",
                nameof(ProficiencyScale), scale.Id, newValue: scale.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return SkillsConfigurationMapper.ToDto(scale);
        }
        catch (Exception ex) when (SkillsConfigurationErrors.IsUserCorrectable(ex))
        {
            return SkillsConfigurationErrors.Invalid<ProficiencyScaleDto>(ex);
        }
    }

    private static void SynchronizeLevels(
        ProficiencyScale scale,
        IReadOnlyList<ProficiencyScaleLevelInput> requested)
    {
        if (requested is null || requested.Count is < ProficiencyScale.MinimumLevelCount or > ProficiencyScale.MaximumLevelCount)
            throw new DomainRuleViolationException("A proficiency scale must contain between three and seven levels.");

        var existing = scale.Levels.ToDictionary(level => level.Id);
        var requestedIds = requested.Where(level => level.Id.HasValue).Select(level => level.Id!.Value).ToArray();
        if (requestedIds.Length != requestedIds.Distinct().Count() || requestedIds.Any(id => !existing.ContainsKey(id)))
            throw new DomainRuleViolationException("Every supplied proficiency level must belong to this scale exactly once.");

        foreach (var input in requested.Where(level => level.Id.HasValue))
            scale.UpdateLevel(input.Id!.Value, input.Label, input.Description);

        var removed = existing.Keys.Where(id => !requestedIds.Contains(id)).ToList();
        var added = requested
            .Select((level, index) => (Level: level, Index: index))
            .Where(item => !item.Level.Id.HasValue)
            .ToList();
        var createdIds = new Dictionary<int, Guid>();

        while (removed.Count > 0 || added.Count > 0)
        {
            if (added.Count > 0 && (scale.Levels.Count == ProficiencyScale.MinimumLevelCount || scale.Levels.Count < requested.Count))
            {
                var input = added[0];
                added.RemoveAt(0);
                createdIds[input.Index] = scale.AddLevel(
                    new ProficiencyScaleLevelDraft(input.Level.Label, input.Level.Description)).Id;
            }
            else if (removed.Count > 0)
            {
                scale.RemoveLevel(removed[0]);
                removed.RemoveAt(0);
            }
            else
            {
                var input = added[0];
                added.RemoveAt(0);
                createdIds[input.Index] = scale.AddLevel(
                    new ProficiencyScaleLevelDraft(input.Level.Label, input.Level.Description)).Id;
            }
        }

        scale.ReorderLevels(requested.Select((input, index) => input.Id ?? createdIds[index]).ToArray());
    }
}

public sealed class SetProficiencyScaleStatusCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<SetProficiencyScaleStatusCommand, Result<ProficiencyScaleDto>>
{
    public async Task<Result<ProficiencyScaleDto>> Handle(
        SetProficiencyScaleStatusCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(command.Actor))
            return SkillsConfigurationErrors.Forbidden<ProficiencyScaleDto>();

        var scale = await db.ProficiencyScales
            .Include(item => item.Levels)
            .SingleOrDefaultAsync(item => item.Id == command.ScaleId, cancellationToken);
        if (scale is null)
            return Result.Failure<ProficiencyScaleDto>(Error.NotFound("ProficiencyScale", command.ScaleId));

        try
        {
            if (command.TargetStatus == EvaluationConfigStatus.Active)
                scale.Activate();
            else if (command.TargetStatus == EvaluationConfigStatus.Archived)
                scale.Archive();
            else
                throw new DomainRuleViolationException("A proficiency scale can only be activated or archived.");

            await SkillsConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, $"ProficiencyScale{command.TargetStatus}",
                nameof(ProficiencyScale), scale.Id, newValue: command.TargetStatus.ToString(),
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return SkillsConfigurationMapper.ToDto(scale);
        }
        catch (DbUpdateException)
        {
            return SkillsConfigurationErrors.NameConflict<ProficiencyScaleDto>("proficiency scale");
        }
        catch (Exception ex) when (SkillsConfigurationErrors.IsUserCorrectable(ex))
        {
            return SkillsConfigurationErrors.Invalid<ProficiencyScaleDto>(ex);
        }
    }
}

public sealed class DuplicateProficiencyScaleCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<DuplicateProficiencyScaleCommand, Result<ProficiencyScaleDto>>
{
    public async Task<Result<ProficiencyScaleDto>> Handle(
        DuplicateProficiencyScaleCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(command.Actor))
            return SkillsConfigurationErrors.Forbidden<ProficiencyScaleDto>();

        var source = await db.ProficiencyScales
            .AsNoTracking()
            .Include(item => item.Levels)
            .SingleOrDefaultAsync(item => item.Id == command.ScaleId, cancellationToken);
        if (source is null)
            return Result.Failure<ProficiencyScaleDto>(Error.NotFound("ProficiencyScale", command.ScaleId));

        try
        {
            var copy = source.Duplicate(command.Name);
            db.ProficiencyScales.Add(copy);
            await SkillsConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "ProficiencyScaleDuplicated",
                nameof(ProficiencyScale), copy.Id, previousValue: source.Id.ToString(), newValue: copy.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return SkillsConfigurationMapper.ToDto(copy);
        }
        catch (Exception ex) when (SkillsConfigurationErrors.IsUserCorrectable(ex))
        {
            return SkillsConfigurationErrors.Invalid<ProficiencyScaleDto>(ex);
        }
    }
}
