using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Authorization;

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
            var jwtTenantId = context.User.GetTenantId();

            // PlatformAdmin can override tenant context via header (for cross-tenant operations)
            if (context.User.IsInRole(PlatformRole.PlatformAdmin) &&
                context.Request.Headers.TryGetValue(TenantHeader, out var headerValue))
            {
                var headerString = headerValue.FirstOrDefault();
                if (Guid.TryParse(headerString, out var headerTenantId) && headerTenantId != Guid.Empty)
                {
                    return headerTenantId;
                }
            }

            // For non-PlatformAdmin users, only trust tenant from JWT claims (security: prevent privilege escalation)
            return jwtTenantId;
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

        // Authenticated request to a protected endpoint: require tenant context
        return true;
    }
}
