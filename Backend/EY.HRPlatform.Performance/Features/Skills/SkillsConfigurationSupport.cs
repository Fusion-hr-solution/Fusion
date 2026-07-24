using System.Security.Claims;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.Skills;

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
