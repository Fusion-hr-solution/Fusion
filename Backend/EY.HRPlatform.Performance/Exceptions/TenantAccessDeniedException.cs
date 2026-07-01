namespace EY.HRPlatform.Performance.Exceptions;

/// <summary>
/// Thrown when a write is attempted without a resolved tenant context or against a
/// different tenant than the current request. Maps to HTTP 403 Forbidden.
/// </summary>
public sealed class TenantAccessDeniedException : Exception
{
    public TenantAccessDeniedException(string message) : base(message)
    {
    }
}
