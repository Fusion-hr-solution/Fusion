using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class EmployeeObjectivePlanReviewEvent : BaseEntity
{
    public const int ActorNameMaxLength = 256;
    public const int CommentMaxLength = 1000;

    private EmployeeObjectivePlanReviewEvent() { }

    public Guid PlanId { get; private set; }
    public Guid ActorEmployeeId { get; private set; }
    public string ActorName { get; private set; } = string.Empty;
    public ReviewEventType Type { get; private set; }
    public string? Comment { get; private set; }
    public Guid[] ReferencedObjectiveIds { get; private set; } = [];
    public DateTime OccurredAt { get; private set; }

    internal static EmployeeObjectivePlanReviewEvent Create(
        Guid planId,
        EmployeeObjectivePlanReviewActor actor,
        ReviewEventType type,
        DateTime occurredAt,
        string? comment = null,
        IEnumerable<Guid>? referencedObjectiveIds = null)
    {
        ArgumentNullException.ThrowIfNull(actor);

        return new EmployeeObjectivePlanReviewEvent
        {
            Id = Guid.NewGuid(),
            PlanId = planId,
            ActorEmployeeId = actor.EmployeeId,
            ActorName = NormalizeRequired(actor.Name, nameof(actor.Name), ActorNameMaxLength),
            Type = type,
            Comment = NormalizeOptional(comment, nameof(comment), CommentMaxLength),
            ReferencedObjectiveIds = NormalizeReferencedObjectiveIds(referencedObjectiveIds),
            OccurredAt = NormalizeUtc(occurredAt, nameof(occurredAt))
        };
    }

    private static string NormalizeRequired(string value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException($"{paramName} is required.", paramName);

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"{paramName} cannot exceed {maxLength} characters.", paramName);

        return trimmed;
    }

    private static string? NormalizeOptional(string? value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"{paramName} cannot exceed {maxLength} characters.", paramName);

        return trimmed;
    }

    private static Guid[] NormalizeReferencedObjectiveIds(IEnumerable<Guid>? value)
        => value?
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToArray()
           ?? [];

    private static DateTime NormalizeUtc(DateTime value, string paramName)
    {
        if (value == default)
            throw new ArgumentException("A valid date is required.", paramName);

        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}

public sealed record EmployeeObjectivePlanReviewActor(Guid EmployeeId, string Name);
