namespace EY.HRPlatform.Gateway.Middleware;

public class CorrelationIdMiddleware
{
    private const string CorrelationIdHeader = "X-Correlation-Id";
    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        // If the request doesn't have a correlation ID, generate one
        if (!context.Request.Headers.ContainsKey(CorrelationIdHeader))
        {
            context.Request.Headers[CorrelationIdHeader] = Guid.NewGuid().ToString();
        }

        // Copy it to the response so the frontend can see it
        context.Response.Headers[CorrelationIdHeader] =
            context.Request.Headers[CorrelationIdHeader].ToString();

        await _next(context);
    }
}