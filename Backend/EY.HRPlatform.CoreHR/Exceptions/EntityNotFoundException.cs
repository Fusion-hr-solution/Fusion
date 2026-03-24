namespace EY.HRPlatform.CoreHR.Exceptions;

/// <summary>
/// Thrown when a requested entity is not found.
/// Mapped to HTTP 404 Not Found by GlobalExceptionHandlerMiddleware.
/// </summary>
public sealed class EntityNotFoundException : Exception
{
    public string EntityType { get; }
    public object? EntityId { get; }

    public EntityNotFoundException(string entityType, object? entityId = null)
        : base($"{entityType} not found{(entityId is not null ? $" (ID: {entityId})" : "")}.")
    {
        EntityType = entityType;
        EntityId = entityId;
    }

    public EntityNotFoundException(string entityType, object? entityId, Exception innerException)
        : base($"{entityType} not found{(entityId is not null ? $" (ID: {entityId})" : "")}.", innerException)
    {
        EntityType = entityType;
        EntityId = entityId;
    }
}
