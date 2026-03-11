using Serilog.Context;
using System.Security.Claims;

namespace EY.HRPlatform.CoreHR.Middleware;

public class LogContextEnrichmentMiddleware(RequestDelegate next)
{
    private const string CorrelationIdHeader = "X-Correlation-Id";

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers[CorrelationIdHeader].FirstOrDefault() ?? Guid.NewGuid().ToString();
        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var tenantId = context.User.FindFirst("tenant_id")?.Value;

        using (LogContext.PushProperty("CorrelationId", correlationId))
        using (LogContext.PushProperty("UserId", userId))
        using (LogContext.PushProperty("TenantId", tenantId))
        {
            context.Response.Headers[CorrelationIdHeader] = correlationId;
            await next(context);
        }
    }
}
