namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Thrown when a write would cross a tenant boundary or run without a resolved tenant context.
/// </summary>
public sealed class TenantAccessDeniedException(string message) : InvalidOperationException(message);
