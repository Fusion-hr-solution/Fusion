using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.Evaluations.Configuration.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Evaluations.Configuration.Commands;

public sealed record CreateEvaluationRatingScaleCommand(
    ClaimsPrincipal Actor,
    string Name,
    string? Description,
    IReadOnlyList<EvaluationRatingScaleLevelInput> Levels)
    : ICommand<Result<EvaluationRatingScaleDto>>;

public sealed record UpdateEvaluationRatingScaleCommand(
    ClaimsPrincipal Actor,
    Guid ScaleId,
    string Name,
    string? Description,
    IReadOnlyList<EvaluationRatingScaleLevelInput> Levels)
    : ICommand<Result<EvaluationRatingScaleDto>>;

public sealed record SetEvaluationRatingScaleStatusCommand(
    ClaimsPrincipal Actor,
    Guid ScaleId,
    EvaluationConfigStatus TargetStatus)
    : ICommand<Result<EvaluationRatingScaleDto>>;

public sealed record DuplicateEvaluationRatingScaleCommand(
    ClaimsPrincipal Actor,
    Guid ScaleId,
    string Name)
    : ICommand<Result<EvaluationRatingScaleDto>>;

public sealed class CreateEvaluationRatingScaleCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<CreateEvaluationRatingScaleCommand, Result<EvaluationRatingScaleDto>>
{
    public async Task<Result<EvaluationRatingScaleDto>> Handle(
        CreateEvaluationRatingScaleCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageEvaluations(command.Actor))
            return EvaluationConfigurationErrors.Forbidden<EvaluationRatingScaleDto>();

        try
        {
            var scale = EvaluationRatingScale.CreateDraft(
                tenant.TenantId,
                command.Name,
                command.Description,
                command.Levels.Select(level => new EvaluationRatingScaleLevelDraft(
                    level.Label,
                    level.Description,
                    level.BehavioralGuidance)).ToArray());

            db.EvaluationRatingScales.Add(scale);
            await EvaluationConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "EvaluationRatingScaleCreated",
                nameof(EvaluationRatingScale), scale.Id, newValue: scale.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return EvaluationConfigurationMapper.ToDto(scale);
        }
        catch (Exception ex) when (EvaluationConfigurationErrors.IsUserCorrectable(ex))
        {
            return EvaluationConfigurationErrors.Invalid<EvaluationRatingScaleDto>(ex);
        }
    }
}

public sealed class UpdateEvaluationRatingScaleCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<UpdateEvaluationRatingScaleCommand, Result<EvaluationRatingScaleDto>>
{
    public async Task<Result<EvaluationRatingScaleDto>> Handle(
        UpdateEvaluationRatingScaleCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageEvaluations(command.Actor))
            return EvaluationConfigurationErrors.Forbidden<EvaluationRatingScaleDto>();

        var scale = await db.EvaluationRatingScales
            .Include(item => item.Levels)
            .SingleOrDefaultAsync(item => item.Id == command.ScaleId, cancellationToken);
        if (scale is null)
            return Result.Failure<EvaluationRatingScaleDto>(Error.NotFound("EvaluationRatingScale", command.ScaleId));

        try
        {
            scale.UpdateDetails(command.Name, command.Description);
            SynchronizeLevels(scale, command.Levels);
            await EvaluationConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "EvaluationRatingScaleUpdated",
                nameof(EvaluationRatingScale), scale.Id, newValue: scale.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return EvaluationConfigurationMapper.ToDto(scale);
        }
        catch (Exception ex) when (EvaluationConfigurationErrors.IsUserCorrectable(ex))
        {
            return EvaluationConfigurationErrors.Invalid<EvaluationRatingScaleDto>(ex);
        }
    }

    private static void SynchronizeLevels(
        EvaluationRatingScale scale,
        IReadOnlyList<EvaluationRatingScaleLevelInput> requested)
    {
        if (requested is null || requested.Count is < EvaluationRatingScale.MinimumLevelCount or > EvaluationRatingScale.MaximumLevelCount)
            throw new DomainRuleViolationException("A rating scale must contain between three and seven levels.");

        var existing = scale.Levels.ToDictionary(level => level.Id);
        var requestedIds = requested.Where(level => level.Id.HasValue).Select(level => level.Id!.Value).ToArray();
        if (requestedIds.Length != requestedIds.Distinct().Count() || requestedIds.Any(id => !existing.ContainsKey(id)))
            throw new DomainRuleViolationException("Every supplied rating level must belong to this scale exactly once.");

        foreach (var input in requested.Where(level => level.Id.HasValue))
            scale.UpdateLevel(input.Id!.Value, input.Label, input.Description, input.BehavioralGuidance);

        var removed = existing.Keys.Where(id => !requestedIds.Contains(id)).ToList();
        var added = requested
            .Select((level, index) => (Level: level, Index: index))
            .Where(item => !item.Level.Id.HasValue)
            .ToList();
        var createdIds = new Dictionary<int, Guid>();

        while (removed.Count > 0 || added.Count > 0)
        {
            if (added.Count > 0 && (scale.Levels.Count == EvaluationRatingScale.MinimumLevelCount || scale.Levels.Count < requested.Count))
            {
                var input = added[0];
                added.RemoveAt(0);
                createdIds[input.Index] = scale.AddLevel(new EvaluationRatingScaleLevelDraft(
                    input.Level.Label, input.Level.Description, input.Level.BehavioralGuidance)).Id;
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
                createdIds[input.Index] = scale.AddLevel(new EvaluationRatingScaleLevelDraft(
                    input.Level.Label, input.Level.Description, input.Level.BehavioralGuidance)).Id;
            }
        }

        scale.ReorderLevels(requested.Select((input, index) => input.Id ?? createdIds[index]).ToArray());
    }
}

public sealed class SetEvaluationRatingScaleStatusCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<SetEvaluationRatingScaleStatusCommand, Result<EvaluationRatingScaleDto>>
{
    public async Task<Result<EvaluationRatingScaleDto>> Handle(
        SetEvaluationRatingScaleStatusCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageEvaluations(command.Actor))
            return EvaluationConfigurationErrors.Forbidden<EvaluationRatingScaleDto>();

        var scale = await db.EvaluationRatingScales
            .Include(item => item.Levels)
            .SingleOrDefaultAsync(item => item.Id == command.ScaleId, cancellationToken);
        if (scale is null)
            return Result.Failure<EvaluationRatingScaleDto>(Error.NotFound("EvaluationRatingScale", command.ScaleId));

        try
        {
            if (command.TargetStatus == EvaluationConfigStatus.Active)
                scale.Activate();
            else if (command.TargetStatus == EvaluationConfigStatus.Archived)
                scale.Archive();
            else
                throw new DomainRuleViolationException("A rating scale can only be activated or archived.");

            await EvaluationConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, $"EvaluationRatingScale{command.TargetStatus}",
                nameof(EvaluationRatingScale), scale.Id, newValue: command.TargetStatus.ToString(),
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return EvaluationConfigurationMapper.ToDto(scale);
        }
        catch (DbUpdateException)
        {
            return Result.Failure<EvaluationRatingScaleDto>(Error.Conflict(
                "EvaluationRatingScale.ActiveNameConflict",
                "An active rating scale with this name already exists."));
        }
        catch (Exception ex) when (EvaluationConfigurationErrors.IsUserCorrectable(ex))
        {
            return EvaluationConfigurationErrors.Invalid<EvaluationRatingScaleDto>(ex);
        }
    }
}

public sealed class DuplicateEvaluationRatingScaleCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<DuplicateEvaluationRatingScaleCommand, Result<EvaluationRatingScaleDto>>
{
    public async Task<Result<EvaluationRatingScaleDto>> Handle(
        DuplicateEvaluationRatingScaleCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageEvaluations(command.Actor))
            return EvaluationConfigurationErrors.Forbidden<EvaluationRatingScaleDto>();

        var source = await db.EvaluationRatingScales
            .AsNoTracking()
            .Include(item => item.Levels)
            .SingleOrDefaultAsync(item => item.Id == command.ScaleId, cancellationToken);
        if (source is null)
            return Result.Failure<EvaluationRatingScaleDto>(Error.NotFound("EvaluationRatingScale", command.ScaleId));

        try
        {
            var copy = source.Duplicate(command.Name);
            db.EvaluationRatingScales.Add(copy);
            await EvaluationConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "EvaluationRatingScaleDuplicated",
                nameof(EvaluationRatingScale), copy.Id, previousValue: source.Id.ToString(), newValue: copy.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return EvaluationConfigurationMapper.ToDto(copy);
        }
        catch (Exception ex) when (EvaluationConfigurationErrors.IsUserCorrectable(ex))
        {
            return EvaluationConfigurationErrors.Invalid<EvaluationRatingScaleDto>(ex);
        }
    }
}

internal static class EvaluationConfigurationErrors
{
    public static bool IsUserCorrectable(Exception exception) =>
        exception is DomainRuleViolationException or ArgumentException or InvalidOperationException;

    public static Result<T> Forbidden<T>() => Result.Failure<T>(Error.Forbidden(
        "Evaluations.Forbidden",
        "You do not have permission to manage evaluation configuration."));

    public static Result<T> Invalid<T>(Exception exception) => Result.Failure<T>(Error.Validation(
        "Evaluations.InvalidConfiguration",
        exception.Message));
}

internal static class EvaluationConfigurationAudit
{
    public static Task AppendAsync(
        IConfigurationAuditWriter audit,
        Guid tenantId,
        ClaimsPrincipal actor,
        string action,
        string entityType,
        Guid entityId,
        string? previousValue = null,
        string? newValue = null,
        CancellationToken cancellationToken = default) =>
        audit.AppendTenantAsync(
            tenantId,
            actor.GetUserId(),
            actor.GetFullName(),
            action,
            entityType,
            entityId,
            previousValue: previousValue,
            newValue: newValue,
            cancellationToken: cancellationToken);
}
