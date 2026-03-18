namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Exception thrown when a tenant access violation is detected during SaveChanges.
/// Mapped to HTTP 403 Forbidden by the global exception handler.
/// </summary>
public sealed class TenantAccessDeniedException : Exception
{
    public TenantAccessDeniedException(string message) : base(message)
    {
    }
}
