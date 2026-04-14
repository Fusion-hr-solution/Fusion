namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Exception thrown when a tenant access violation is detected during SaveChanges.
/// </summary>
public sealed class TenantAccessDeniedException : Exception
{
    public TenantAccessDeniedException(string message) : base(message)
    {
    }
}
