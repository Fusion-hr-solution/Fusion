using System.Globalization;
using System.Security.Claims;
using System.Threading.RateLimiting;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.Performance.Models.Responses;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace EY.HRPlatform.Performance.Extensions;

/// <summary>
/// Throttling for the fan-out endpoints — population preview, campaign launch, evaluation round
/// launch, tenant provisioning. Applied in the service rather than the Gateway (design D10): the
/// Gateway's routes include modules owned by other teams, and a Performance-specific policy must
/// not risk their surfaces.
/// </summary>
public static class RateLimitingExtensions
{
    /// <summary>Name to put on <c>[EnableRateLimiting]</c> at an expensive endpoint.</summary>
    public const string ExpensiveOperationPolicy = "performance-expensive";

    public static IServiceCollection AddPerformanceRateLimiting(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var options = configuration
            .GetSection(PerformanceRateLimitOptions.SectionName)
            .Get<PerformanceRateLimitOptions>() ?? new PerformanceRateLimitOptions();

        services.AddRateLimiter(limiter =>
        {
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Rejection happens before the endpoint runs, so a throttled launch executes no
            // partial work — nothing is resolved, frozen, or written.
            limiter.OnRejected = async (context, cancellationToken) =>
            {
                var retryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var window)
                    ? (int)Math.Ceiling(window.TotalSeconds)
                    : options.WindowSeconds;

                context.HttpContext.Response.Headers.RetryAfter =
                    retryAfter.ToString(NumberFormatInfo.InvariantInfo);
                context.HttpContext.Response.ContentType = "application/problem+json";

                // Same problem shape as every other failure source, so clients need one reader.
                var problem = new ProblemDetails
                {
                    Status = StatusCodes.Status429TooManyRequests,
                    Title = "Too many requests",
                    Detail = "Too many expensive requests. No changes were made. "
                        + $"Try again in {retryAfter} seconds.",
                    Type = "https://fusion.ey/problems/Performance.RateLimited",
                    Instance = context.HttpContext.Request.Path
                };

                problem.Extensions[PerformanceProblem.CodeExtension] = "Performance.RateLimited";
                problem.Extensions[PerformanceProblem.CorrelationIdExtension] =
                    PerformanceProblem.ResolveCorrelationId(context.HttpContext);
                problem.Extensions["retryAfterSeconds"] = retryAfter;

                await context.HttpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
            };

            limiter.AddPolicy(ExpensiveOperationPolicy, httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(
                    ResolveCallerKey(httpContext),
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = options.PermitLimit,
                        Window = TimeSpan.FromSeconds(options.WindowSeconds),
                        QueueLimit = 0,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst
                    }));
        });

        return services;
    }

    /// <summary>
    /// Partitions per caller, and per tenant when the caller is anonymous, so one tenant's fan-out
    /// cannot exhaust another's allowance.
    /// </summary>
    private static string ResolveCallerKey(HttpContext httpContext)
    {
        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrWhiteSpace(userId))
        {
            return $"user:{userId}";
        }

        var tenantId = httpContext.RequestServices.GetService<ITenantContext>()?.TenantIdOrDefault;
        return tenantId is not null
            ? $"tenant:{tenantId}"
            : $"host:{httpContext.Connection.RemoteIpAddress}";
    }
}

public sealed class PerformanceRateLimitOptions
{
    public const string SectionName = "RateLimiting";

    /// <summary>Expensive requests allowed per caller per window.</summary>
    public int PermitLimit { get; set; } = 5;

    public int WindowSeconds { get; set; } = 60;
}
