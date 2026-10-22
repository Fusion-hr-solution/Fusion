using System.Globalization;
using System.Security.Claims;
using System.Text.RegularExpressions;
using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.SharedKernel.Api;

namespace EY.HRPlatform.Performance.Middleware;

/// <summary>
/// The Development-only demo clock (performance-demo-clock): a request carrying
/// <c>X-Demo-Clock: &lt;past instant&gt;</c> runs as if it were that moment, so demo history goes
/// through the same rules, authorization, audit and notifications as live use. Refused in every
/// other environment, so a record can never claim a time it wasn't written at outside local demos.
/// </summary>
public sealed partial class DemoClockMiddleware(RequestDelegate next, IHostEnvironment environment, ILogger<DemoClockMiddleware> logger)
{
    public const string Header = "X-Demo-Clock";

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Headers.TryGetValue(Header, out var values))
        {
            await next(context);
            return;
        }

        if (!environment.IsDevelopment())
        {
            await RefuseAsync(context, "demo_clock_unavailable", "The demo clock is available in Development only.");
            return;
        }

        // No request has set the clock yet, so this is the real time.
        var realNow = PerformanceClock.UtcNow;
        if (values.Count != 1 || !TryParseInstant(values[0], out var instant) || instant > realNow)
        {
            await RefuseAsync(context, "demo_clock_invalid", $"{Header} must be one past ISO 8601 instant with an offset.");
            return;
        }

        logger.LogInformation(
            "Demo clock {SimulatedAt:O} for user {UserId} on {Method} {Path} at {RealAt:O}",
            instant, context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value, context.Request.Method, context.Request.Path, realNow);

        using (PerformanceClock.Travel(instant))
            await next(context);
    }

    private static bool TryParseInstant(string? value, out DateTime instantUtc)
    {
        instantUtc = default;
        if (value is null || !InstantWithOffset().IsMatch(value)) return false;
        if (!DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)) return false;
        instantUtc = parsed.UtcDateTime;
        return true;
    }

    private static Task RefuseAsync(HttpContext context, string code, string message)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return context.Response.WriteAsJsonAsync(ApiResponse.Failure(message, new { code }));
    }

    [GeneratedRegex(@"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,7})?)?(Z|[+-]\d{2}:\d{2})$")]
    private static partial Regex InstantWithOffset();
}
