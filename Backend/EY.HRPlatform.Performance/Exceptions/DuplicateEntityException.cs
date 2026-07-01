namespace EY.HRPlatform.Performance.Exceptions;

/// <summary>
/// Thrown when creating an entity would violate a uniqueness constraint.
/// Maps to HTTP 409 Conflict.
/// </summary>
public sealed class DuplicateEntityException : Exception
{
    public string EntityType { get; }

    public DuplicateEntityException(string entityType, string message)
        : base(message)
    {
        EntityType = entityType;
    }
}
