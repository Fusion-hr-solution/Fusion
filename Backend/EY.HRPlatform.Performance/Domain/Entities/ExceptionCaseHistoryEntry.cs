using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class ExceptionCaseHistoryEntry : BaseEntity, ITenantEntity
{
    private ExceptionCaseHistoryEntry() { }

    public Guid TenantId { get; private set; }
    public Guid ExceptionCaseId { get; private set; }
    public string AttemptType { get; private set; } = string.Empty;
    public Guid? FromOwnerEmployeeId { get; private set; }
    public Guid? ToOwnerEmployeeId { get; private set; }
    public ExceptionResolutionAction? Action { get; private set; }
    public Guid ActorEmployeeId { get; private set; }
    public string Reason { get; private set; } = string.Empty;
    public string Outcome { get; private set; } = string.Empty;
    public DateTime OccurredAt { get; private set; }

    public static ExceptionCaseHistoryEntry Create(
        Guid tenantId,
        Guid exceptionCaseId,
        string attemptType,
        Guid? fromOwnerEmployeeId,
        Guid? toOwnerEmployeeId,
        ExceptionResolutionAction? action,
        Guid actorEmployeeId,
        string reason,
        string outcome,
        DateTime occurredAt)
    {
        if (tenantId == Guid.Empty || exceptionCaseId == Guid.Empty || actorEmployeeId == Guid.Empty)
            throw new ArgumentException("Tenant, case, and actor are required.");

        return new ExceptionCaseHistoryEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ExceptionCaseId = exceptionCaseId,
            AttemptType = Require(attemptType, 100, nameof(attemptType)),
            FromOwnerEmployeeId = fromOwnerEmployeeId,
            ToOwnerEmployeeId = toOwnerEmployeeId,
            Action = action,
            ActorEmployeeId = actorEmployeeId,
            Reason = Require(reason, 2000, nameof(reason)),
            Outcome = Require(outcome, 200, nameof(outcome)),
            OccurredAt = NormalizeUtc(occurredAt)
        };
    }

    private static string Require(string value, int maximum, string parameterName)
    {
        var normalized = value.Trim();
        if (normalized.Length == 0 || normalized.Length > maximum)
            throw new ArgumentException($"Value must be between 1 and {maximum} characters.", parameterName);
        return normalized;
    }

    private static DateTime NormalizeUtc(DateTime value)
        => value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
}
