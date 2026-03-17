using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Middleware;

/// <summary>
/// Resolves the tenant context from JWT claims or request headers.
/// Must be registered after authentication middleware.
/// </summary>
public sealed class TenantResolutionMiddleware(RequestDelegate next, ILogger<TenantResolutionMiddleware> logger)
{
    private const string TenantHeader = "X-Tenant-Id";

    public async Task InvokeAsync(HttpContext context, TenantContext tenantContext)
    {
        var tenantId = ResolveTenantId(context);

        if (tenantId.HasValue)
        {
            tenantContext.SetTenant(tenantId.Value);
            logger.LogDebug("Tenant context resolved: {TenantId}", tenantId.Value);
        }
        else if (RequiresTenantContext(context))
        {
            logger.LogWarning("Tenant context required but not provided for {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { error = "Tenant context required." });
            return;
        }

        await next(context);
    }

    private static Guid? ResolveTenantId(HttpContext context)
    {
        // 1. Try JWT claim (preferred when Identity emits tenant_id)
        var claimTenantId = context.User.GetTenantId();
        if (claimTenantId.HasValue)
            return claimTenantId;

        // 2. Fallback to header (for cross-service calls or when Identity doesn't have tenant info)
        if (context.Request.Headers.TryGetValue(TenantHeader, out var headerValue))
        {
            var headerString = headerValue.FirstOrDefault();
            if (Guid.TryParse(headerString, out var headerId) && headerId != Guid.Empty)
                return headerId;
        }

        return null;
    }

    private static bool RequiresTenantContext(HttpContext context)
    {
        // Only require tenant for authenticated requests to protected endpoints
        if (context.User.Identity?.IsAuthenticated != true)
            return false;

        var path = context.Request.Path;

        // Health, metrics, and swagger are always tenant-optional
        if (path.StartsWithSegments("/health") ||
            path.StartsWithSegments("/metrics") ||
            path.StartsWithSegments("/api/corehr/swagger"))
            return false;

        return true;
    }
}
