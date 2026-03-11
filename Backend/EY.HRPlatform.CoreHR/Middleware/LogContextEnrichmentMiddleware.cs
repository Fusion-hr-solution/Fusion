using Serilog.Context;
using System.Security.Claims;

namespace EY.HRPlatform.CoreHR.Middleware;

public class LogContextEnrichmentMiddleware(RequestDelegate next)
{
    private const string CorrelationIdHeader = "X-Correlation-Id";

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers[CorrelationIdHeader].FirstOrDefault();
        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        using (LogContext.PushProperty("CorrelationId", correlationId))
        using (LogContext.PushProperty("UserId", userId))
        {
            await next(context);
        }
    }
}
