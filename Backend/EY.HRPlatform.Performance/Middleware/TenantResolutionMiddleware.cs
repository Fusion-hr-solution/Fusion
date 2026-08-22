using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.Performance.Middleware;

/// <summary>
/// Resolves the tenant context from JWT claims (authenticated customer traffic) or the
/// <c>X-Tenant-Id</c> header (unauthenticated internal service calls). Registered after
/// authentication so claims are populated. A caller-supplied header never overrides trusted
/// claims for an authenticated request.
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
        if (context.User.Identity?.IsAuthenticated == true)
            return context.User.GetTenantId();

        if (context.Request.Headers.TryGetValue(TenantHeader, out var headerValue)
            && Guid.TryParse(headerValue.FirstOrDefault(), out var headerId)
            && headerId != Guid.Empty)
            return headerId;

        return null;
    }

    private static bool RequiresTenantContext(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated != true)
            return false;

        var endpoint = context.GetEndpoint();
        if (endpoint is null)
            return false;
        if (endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null)
            return false;
        if (endpoint.Metadata.GetMetadata<IAuthorizeData>() is null)
            return false;

        return true;
    }
}
