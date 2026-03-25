namespace EY.HRPlatform.SharedKernel.Exceptions;

/// <summary>
/// Thrown when attempting to create or update an entity that would violate uniqueness constraints.
/// Mapped to HTTP 409 Conflict by GlobalExceptionHandlerMiddleware.
/// </summary>
public sealed class DuplicateEntityException : Exception
{
    public string EntityType { get; }
    public string? ConflictField { get; }
    public object? ConflictValue { get; }

    public DuplicateEntityException(string entityType, string? conflictField = null, object? conflictValue = null)
        : base(BuildMessage(entityType, conflictField, conflictValue))
    {
        EntityType = entityType;
        ConflictField = conflictField;
        ConflictValue = conflictValue;
    }

    private static string BuildMessage(string entityType, string? conflictField, object? conflictValue)
    {
        if (conflictField is not null && conflictValue is not null)
            return $"{entityType} with {conflictField} '{conflictValue}' already exists.";

        if (conflictField is not null)
            return $"{entityType} with this {conflictField} already exists.";

        return $"{entityType} already exists.";
    }
}
