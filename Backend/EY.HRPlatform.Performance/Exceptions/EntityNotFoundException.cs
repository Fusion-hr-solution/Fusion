namespace EY.HRPlatform.Performance.Exceptions;

/// <summary>
/// Thrown when an entity cannot be found within the current tenant scope.
/// Maps to HTTP 404 Not Found.
/// </summary>
public sealed class EntityNotFoundException : Exception
{
    public string EntityType { get; }

    public EntityNotFoundException(string entityType, Guid entityId)
        : base($"The {entityType} with ID '{entityId}' was not found.")
    {
        EntityType = entityType;
    }

    public EntityNotFoundException(string entityType, string message)
        : base(message)
    {
        EntityType = entityType;
    }
}
