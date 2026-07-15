using EY.HRPlatform.SharedKernel.Multitenancy;
using Serilog.Context;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Middleware;

public class LogContextEnrichmentMiddleware(RequestDelegate next)
{
    private const string CorrelationIdHeader = "X-Correlation-Id";

    public async Task InvokeAsync(HttpContext context, ITenantContext tenantContext)
    {
        var correlationId = context.Request.Headers[CorrelationIdHeader].FirstOrDefault()
            ?? context.TraceIdentifier;
        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var tenantId = tenantContext.TenantIdOrDefault?.ToString();

        using (LogContext.PushProperty("CorrelationId", correlationId))
        using (LogContext.PushProperty("UserId", userId))
        using (LogContext.PushProperty("TenantId", tenantId))
        {
            await next(context);
        }
    }
}
