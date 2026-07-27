using System.Reflection;
using System.Text.Json;
using System.Threading.RateLimiting;
using EY.HRPlatform.Performance.Controllers;
using EY.HRPlatform.Performance.Extensions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Infrastructure;

/// <summary>
/// Throttling on the fan-out endpoints (design D10). Rejection happens in middleware before the
/// endpoint runs, which is what guarantees a throttled launch executes no partial work — nothing
/// is resolved, no participant baseline is frozen, nothing is written.
/// </summary>
public sealed class RateLimitingTests
{
    private static RateLimiterOptions BuildOptions(int permitLimit = 5, int windowSeconds = 60)
    {
        var services = new ServiceCollection();
        services.AddLogging();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["RateLimiting:PermitLimit"] = permitLimit.ToString(),
                ["RateLimiting:WindowSeconds"] = windowSeconds.ToString()
            })
            .Build();

        services.AddPerformanceRateLimiting(configuration);

        return services.BuildServiceProvider()
            .GetRequiredService<IOptions<RateLimiterOptions>>().Value;
    }

    [Theory]
    [InlineData(typeof(PerformanceCyclesController), "PreviewPopulation")]
    [InlineData(typeof(PerformanceCyclesController), "Launch")]
    [InlineData(typeof(EvaluationRoundsController), "Launch")]
    [InlineData(typeof(InternalPerformanceProvisioningController), "Provision")]
    public void The_expensive_endpoints_carry_the_throttling_policy(Type controller, string action)
    {
        var method = controller
            .GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .Single(candidate => candidate.Name == action);

        var attribute = method.GetCustomAttribute<EnableRateLimitingAttribute>();

        Assert.NotNull(attribute);
        Assert.Equal(RateLimitingExtensions.ExpensiveOperationPolicy, attribute.PolicyName);
    }

    [Fact]
    public void Rejection_uses_429_so_the_endpoint_never_runs()
    {
        Assert.Equal(StatusCodes.Status429TooManyRequests, BuildOptions().RejectionStatusCode);
    }

    [Fact]
    public async Task A_throttled_request_is_told_when_to_retry_and_that_nothing_changed()
    {
        var options = BuildOptions(windowSeconds: 45);
        Assert.NotNull(options.OnRejected);

        var httpContext = new DefaultHttpContext();
        var body = new MemoryStream();
        httpContext.Response.Body = body;

        await options.OnRejected!(
            new OnRejectedContext { HttpContext = httpContext, Lease = new RejectedLease() },
            CancellationToken.None);

        Assert.Equal("45", httpContext.Response.Headers.RetryAfter);

        body.Position = 0;
        using var payload = JsonDocument.Parse(body);
        var root = payload.RootElement;

        // Same problem shape as every other failure source: a code, a correlation id, and a
        // message that says plainly that nothing was written.
        Assert.Equal(StatusCodes.Status429TooManyRequests, root.GetProperty("status").GetInt32());
        Assert.Equal("Performance.RateLimited", root.GetProperty("code").GetString());
        Assert.Equal(45, root.GetProperty("retryAfterSeconds").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("correlationId").GetString()));
        Assert.Contains("No changes were made", root.GetProperty("detail").GetString());
    }

    private sealed class RejectedLease : RateLimitLease
    {
        public override bool IsAcquired => false;
        public override IEnumerable<string> MetadataNames => [];

        public override bool TryGetMetadata(string metadataName, out object? metadata)
        {
            metadata = null;
            return false;
        }
    }
}
