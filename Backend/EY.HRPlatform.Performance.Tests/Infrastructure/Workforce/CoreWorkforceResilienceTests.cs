using System.Net;
using EY.HRPlatform.Performance.Extensions;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.Performance.Tests.Infrastructure.Workforce;

/// <summary>
/// Covers the two Core HR resilience policies (design D9): what is retried, what is not, when the
/// circuit opens, and that a dependency failure never reaches a caller as a partial result.
/// </summary>
public sealed class CoreWorkforceResilienceTests
{
    /// <summary>Counts attempts and answers each with a scripted status.</summary>
    private sealed class CountingHandler(params HttpStatusCode[] statuses) : HttpMessageHandler
    {
        public int Attempts { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var status = statuses[Math.Min(Attempts, statuses.Length - 1)];
            Attempts++;

            var response = new HttpResponseMessage(status);
            if (status == HttpStatusCode.OK)
            {
                response.Content = new StringContent(
                    """{"success":true,"data":[]}""",
                    System.Text.Encoding.UTF8,
                    "application/json");
            }

            return Task.FromResult(response);
        }
    }

    private static ICoreWorkforceClient BuildClient(
        CoreWorkforcePolicyOptions policy,
        HttpMessageHandler handler,
        string clientName = "test-core-client")
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddHttpContextAccessor();
        services.AddTransient<BearerTokenForwardingHandler>();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ServiceUrls:CoreApiBaseUrl"] = "http://core.test"
            })
            .Build();

        ServiceCollectionExtensions.AddCoreWorkforceHttpClient(services, configuration, clientName, policy);
        services.AddHttpClient(clientName).ConfigurePrimaryHttpMessageHandler(() => handler);

        var provider = services.BuildServiceProvider();
        return new CoreWorkforceClient(
            provider.GetRequiredService<IHttpClientFactory>().CreateClient(clientName),
            new InternalServiceRequestSigner(new InternalServiceAuthenticationOptions()));
    }

    private static CoreWorkforcePolicyOptions InteractivePolicy() => new()
    {
        AttemptTimeoutSeconds = 5,
        TotalTimeoutSeconds = 30,
        MaxRetryAttempts = 2,
        RetryDelaySeconds = 0,
        CircuitBreakerSamplingDurationSeconds = 30,
        CircuitBreakerBreakDurationSeconds = 10,
        CircuitBreakerFailureRatio = 1.0,
        CircuitBreakerMinimumThroughput = 100
    };

    private static CoreWorkforcePolicyOptions BulkPolicy() => new()
    {
        AttemptTimeoutSeconds = 10,
        TotalTimeoutSeconds = 60,
        MaxRetryAttempts = 0,
        RetryDelaySeconds = 0,
        CircuitBreakerSamplingDurationSeconds = 60,
        CircuitBreakerBreakDurationSeconds = 30,
        CircuitBreakerFailureRatio = 1.0,
        CircuitBreakerMinimumThroughput = 100
    };

    [Fact]
    public async Task Interactive_policy_retries_a_transient_failure_and_succeeds()
    {
        var handler = new CountingHandler(
            HttpStatusCode.ServiceUnavailable,
            HttpStatusCode.ServiceUnavailable,
            HttpStatusCode.OK);
        var client = BuildClient(InteractivePolicy(), handler, "retry-transient");

        var result = await client.GetManagerChainAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.Empty(result);
        Assert.Equal(3, handler.Attempts); // initial attempt + 2 retries
    }

    [Fact]
    public async Task Interactive_policy_does_not_retry_a_client_error()
    {
        var handler = new CountingHandler(HttpStatusCode.BadRequest);
        var client = BuildClient(InteractivePolicy(), handler, "no-retry-client-error");

        // A 400 means the request itself was wrong: retrying cannot help, and it is not a
        // dependency failure.
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => client.GetManagerChainAsync(Guid.NewGuid(), CancellationToken.None));

        Assert.Equal(1, handler.Attempts);
    }

    [Fact]
    public async Task Bulk_policy_does_not_retry_a_transient_failure()
    {
        var handler = new CountingHandler(HttpStatusCode.ServiceUnavailable);
        var client = BuildClient(BulkPolicy(), handler, "bulk-no-retry");

        await Assert.ThrowsAsync<CoreWorkforceUnavailableException>(
            () => client.GetManagerChainAsync(Guid.NewGuid(), CancellationToken.None));

        // Exactly one attempt: a retried full-population resolve would double load on an
        // already-struggling Core HR.
        Assert.Equal(1, handler.Attempts);
    }

    [Fact]
    public async Task Server_failure_surfaces_as_a_dependency_failure_not_an_internal_fault()
    {
        var handler = new CountingHandler(HttpStatusCode.ServiceUnavailable);
        var client = BuildClient(BulkPolicy(), handler, "dependency-failure");

        var exception = await Assert.ThrowsAsync<CoreWorkforceUnavailableException>(
            () => client.GetManagerChainAsync(Guid.NewGuid(), CancellationToken.None));

        Assert.Equal(
            PerformanceDependencyErrors.CoreWorkforceUnavailableCode,
            exception.ToError().Code);
    }

    [Fact]
    public async Task Circuit_breaker_opens_after_sustained_failure()
    {
        var policy = BulkPolicy();
        policy.CircuitBreakerMinimumThroughput = 2;
        policy.CircuitBreakerFailureRatio = 0.1;
        policy.CircuitBreakerSamplingDurationSeconds = 30;

        var handler = new CountingHandler(HttpStatusCode.ServiceUnavailable);
        var client = BuildClient(policy, handler, "breaker-opens");

        for (var i = 0; i < 4; i++)
        {
            await Assert.ThrowsAsync<CoreWorkforceUnavailableException>(
                () => client.GetManagerChainAsync(Guid.NewGuid(), CancellationToken.None));
        }

        var attemptsBefore = handler.Attempts;

        // Once open, the circuit short-circuits: the call fails without reaching Core HR at all.
        await Assert.ThrowsAsync<CoreWorkforceUnavailableException>(
            () => client.GetManagerChainAsync(Guid.NewGuid(), CancellationToken.None));

        Assert.Equal(attemptsBefore, handler.Attempts);
    }

    [Fact]
    public async Task Bearer_token_is_forwarded_on_every_attempt_including_retries()
    {
        var authorizationValues = new List<string?>();

        var recorder = new AuthorizationRecordingHandler(authorizationValues);
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IHttpContextAccessor>(
            new FixedHttpContextAccessor("Bearer caller-token"));
        services.AddTransient<BearerTokenForwardingHandler>();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ServiceUrls:CoreApiBaseUrl"] = "http://core.test"
            })
            .Build();

        ServiceCollectionExtensions.AddCoreWorkforceHttpClient(
            services, configuration, "forwarding", InteractivePolicy());
        services.AddHttpClient("forwarding").ConfigurePrimaryHttpMessageHandler(() => recorder);

        var provider = services.BuildServiceProvider();
        var client = new CoreWorkforceClient(
            provider.GetRequiredService<IHttpClientFactory>().CreateClient("forwarding"),
            new InternalServiceRequestSigner(new InternalServiceAuthenticationOptions()));

        await client.GetManagerChainAsync(Guid.NewGuid(), CancellationToken.None);

        // Three attempts, and the caller's token is present on each — the forwarding handler sits
        // inside the resilience pipeline, not outside it.
        Assert.Equal(3, authorizationValues.Count);
        Assert.All(authorizationValues, value => Assert.Equal("Bearer caller-token", value));
    }

    private sealed class AuthorizationRecordingHandler(List<string?> captured) : HttpMessageHandler
    {
        private int _attempts;

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            captured.Add(request.Headers.Authorization?.ToString());
            _attempts++;

            if (_attempts < 3)
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    """{"success":true,"data":[]}""",
                    System.Text.Encoding.UTF8,
                    "application/json")
            });
        }
    }

    private sealed class FixedHttpContextAccessor : IHttpContextAccessor
    {
        public FixedHttpContextAccessor(string authorizationHeader)
        {
            var context = new DefaultHttpContext();
            context.Request.Headers["Authorization"] = authorizationHeader;
            HttpContext = context;
        }

        public HttpContext? HttpContext { get; set; }
    }
}
