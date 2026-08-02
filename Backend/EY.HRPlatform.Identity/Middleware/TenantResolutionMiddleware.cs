using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.Identity.Middleware;

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
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { errors = new[] { "Tenant context required." } });
            return;
        }

        await next(context);
    }

    private static Guid? ResolveTenantId(HttpContext context)
    {
        var isAuthenticated = context.User.Identity?.IsAuthenticated == true;

        if (isAuthenticated)
        {
            // Customer tenant context comes only from the trusted membership-derived
            // claim. A caller-supplied header never establishes or overrides it,
            // including for a Platform Administrator: control-plane authority is
            // not a way into a customer tenant.
            return context.User.GetTenantId();
        }

        // For unauthenticated requests (e.g., internal service-to-service calls), allow header-based resolution
        if (context.Request.Headers.TryGetValue(TenantHeader, out var unauthHeaderValue))
        {
            var headerString = unauthHeaderValue.FirstOrDefault();
            if (Guid.TryParse(headerString, out var headerId) && headerId != Guid.Empty)
                return headerId;
        }

        return null;
    }

    private static bool RequiresTenantContext(HttpContext context)
    {
        // Only require tenant for authenticated requests
        if (context.User.Identity?.IsAuthenticated != true)
            return false;

        // Use endpoint metadata to determine if this is a protected endpoint
        var endpoint = context.GetEndpoint();
        if (endpoint is null)
            return false;

        // If endpoint explicitly allows anonymous, don't require tenant
        if (endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null)
            return false;

        // If no authorization metadata, treat as public endpoint
        if (endpoint.Metadata.GetMetadata<IAuthorizeData>() is null)
            return false;

        // Control-plane endpoints are authorized by Platform Administrator role and
        // operate across the platform rather than inside one customer tenant. A
        // Platform Administrator holds no membership and therefore no tenant claim,
        // so demanding customer tenant context here would make the control plane
        // unreachable. Their customer-workspace denial is enforced by the absence
        // of that claim everywhere else, not by this middleware.
        if (IsPlatformControlPlaneRoute(context))
            return false;

        // Authenticated request to a tenant-scoped protected endpoint.
        return true;
    }

    private static bool IsPlatformControlPlaneRoute(HttpContext context)
        => context.Request.Path.StartsWithSegments("/api/identity/platform-admin", StringComparison.OrdinalIgnoreCase);
}
