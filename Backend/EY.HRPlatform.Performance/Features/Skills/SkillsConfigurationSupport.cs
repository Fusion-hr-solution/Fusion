using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Skills;

/// <summary>
/// Case-insensitive tenant-unique name pre-checks over the normalized-name key. The filtered
/// unique indexes remain the authority under concurrency; these checks produce the friendly
/// conflict before the database does.
/// </summary>
internal static class SkillsConfigurationNames
{
    public static string Normalize(string name) => (name ?? string.Empty).Trim().ToUpperInvariant();

    public static Task<bool> CategoryTakenAsync(PerformanceDbContext db, string name, Guid? exceptId, CancellationToken ct)
    {
        var normalized = Normalize(name);
        return db.SkillCategories.AnyAsync(c => c.NormalizedName == normalized
            && c.Status != SkillLifecycleStatus.Archived && (exceptId == null || c.Id != exceptId), ct);
    }

    public static Task<bool> SkillTakenAsync(PerformanceDbContext db, string name, Guid? exceptId, CancellationToken ct)
    {
        var normalized = Normalize(name);
        return db.Skills.AnyAsync(s => s.NormalizedName == normalized
            && s.Status != SkillLifecycleStatus.Archived && (exceptId == null || s.Id != exceptId), ct);
    }

    public static Task<bool> ScaleTakenAsync(PerformanceDbContext db, string name, Guid? exceptId, CancellationToken ct)
    {
        var normalized = Normalize(name);
        return db.ProficiencyScales.AnyAsync(s => s.NormalizedName == normalized
            && s.Status != EvaluationConfigStatus.Archived && (exceptId == null || s.Id != exceptId), ct);
    }

    public static Task<bool> SetTakenAsync(PerformanceDbContext db, string name, Guid? exceptId, CancellationToken ct)
    {
        var normalized = Normalize(name);
        return db.SkillExpectationSets.AnyAsync(s => s.NormalizedName == normalized
            && s.Status != EvaluationConfigStatus.Archived && (exceptId == null || s.Id != exceptId), ct);
    }
}

internal static class SkillsConfigurationErrors
{
    public static bool IsUserCorrectable(Exception exception) =>
        exception is DomainRuleViolationException or ArgumentException or InvalidOperationException;

    public static Result<T> Forbidden<T>() => Result.Failure<T>(Error.Forbidden(
        "Skills.Forbidden",
        "You do not have permission to manage skills configuration."));

    public static Result<T> Invalid<T>(Exception exception) => Result.Failure<T>(Error.Validation(
        "Skills.InvalidConfiguration",
        exception.Message));

    public static Result<T> NameConflict<T>(string entity) => Result.Failure<T>(Error.Conflict(
        $"Skills.{entity}Conflict",
        $"An active {entity} with this name already exists."));
}

internal static class SkillsConfigurationAudit
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
