namespace EY.HRPlatform.CoreHR.Exceptions;

/// <summary>
/// Thrown when a concurrent modification conflict is detected (optimistic concurrency failure).
/// Maps to HTTP 409 Conflict.
/// </summary>
public sealed class ConcurrencyException : Exception
{
    public string EntityType { get; }
    public Guid EntityId { get; }

    public ConcurrencyException(string entityType, Guid entityId)
        : base($"The {entityType} with ID '{entityId}' was modified by another request. Please refresh and try again.")
    {
        EntityType = entityType;
        EntityId = entityId;
    }
}
