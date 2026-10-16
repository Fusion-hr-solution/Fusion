using System.Net;
using EY.HRPlatform.Performance.Infrastructure.Ai;
using EY.HRPlatform.SharedKernel.Ai;
using Microsoft.Extensions.Configuration;

namespace EY.HRPlatform.Performance.Tests.Ai;

public sealed class PerformanceAiFoundationTests
{
    [Fact]
    public void MissingKeyIsNotConfigured()
    {
        var gate = new AiAvailability(configured: false);
        Assert.Equal(AiAvailabilityState.NotConfigured, gate.State);
        Assert.False(gate.IsAvailable);
    }

    [Fact]
    public void ThreeTransientFailuresCoolDownThenRecover()
    {
        var clock = new ManualClock();
        var gate = new AiAvailability(true, clock);

        gate.RecordFailure(AiFailureCategory.Timeout);
        gate.RecordFailure(AiFailureCategory.RateLimited);
        Assert.True(gate.IsAvailable);
        gate.RecordFailure(AiFailureCategory.ProviderUnavailable);
        Assert.Equal(AiAvailabilityState.CoolingDown, gate.State);

        clock.Advance(TimeSpan.FromSeconds(89));
        Assert.False(gate.IsAvailable);
        clock.Advance(TimeSpan.FromSeconds(2));
        Assert.True(gate.IsAvailable);
    }

    [Fact]
    public void SuccessResetsTheFailureCount()
    {
        var gate = new AiAvailability(true, new ManualClock());
        gate.RecordFailure(AiFailureCategory.Timeout);
        gate.RecordFailure(AiFailureCategory.Timeout);
        gate.RecordSuccess();
        gate.RecordFailure(AiFailureCategory.Timeout);
        Assert.True(gate.IsAvailable);
    }

    [Fact]
    public void RetryAfterExtendsTheCooldownUpToTheCap()
    {
        var clock = new ManualClock();
        var gate = new AiAvailability(true, clock);
        var farFuture = clock.GetUtcNow().UtcDateTime.AddMinutes(10);
        for (var i = 0; i < 3; i++) gate.RecordFailure(AiFailureCategory.RateLimited, farFuture);

        clock.Advance(TimeSpan.FromSeconds(119));
        Assert.False(gate.IsAvailable);
        clock.Advance(TimeSpan.FromSeconds(2));
        Assert.True(gate.IsAvailable);
    }

    [Fact]
    public void RefusedCredentialsStayRefused()
    {
        var clock = new ManualClock();
        var gate = new AiAvailability(true, clock);
        gate.RecordFailure(AiFailureCategory.Unauthorized);
        clock.Advance(TimeSpan.FromHours(1));
        gate.RecordSuccess();
        Assert.Equal(AiAvailabilityState.Refused, gate.State);
    }

    [Fact]
    public async Task ProviderWithoutKeyFailsFastWithoutCallingOut()
    {
        var calls = 0;
        var options = new PerformanceAiOptions { ApiKey = null };
        var provider = new PerformanceAiProvider(
            Client(_ => { calls++; return new HttpResponseMessage(HttpStatusCode.OK); }),
            options, new AiAvailability(options.IsConfigured));

        var exception = await Assert.ThrowsAsync<AiProviderException>(
            () => provider.CompleteAsync(Request(), CancellationToken.None));

        Assert.Equal(AiFailureCategory.NotConfigured, exception.Category);
        Assert.Equal(0, calls);
        Assert.False(provider.IsAvailable);
    }

    [Fact]
    public async Task SlowProviderTimesOut()
    {
        var options = new PerformanceAiOptions { ApiKey = "key", TimeoutSeconds = 3 };
        var provider = new PerformanceAiProvider(
            new HttpClient(new HangingHandler()) { BaseAddress = GroqEndpoint.BaseAddress(options.Endpoint) },
            options, new AiAvailability(true));

        var exception = await Assert.ThrowsAsync<AiProviderException>(
            () => provider.CompleteAsync(Request(), CancellationToken.None));

        Assert.Equal(AiFailureCategory.Timeout, exception.Category);
    }

    [Fact]
    public async Task UnreachableProviderIsUnavailable()
    {
        var options = new PerformanceAiOptions { ApiKey = "key" };
        var provider = new PerformanceAiProvider(
            Client(_ => throw new HttpRequestException("connection refused")),
            options, new AiAvailability(true));

        var exception = await Assert.ThrowsAsync<AiProviderException>(
            () => provider.CompleteAsync(Request(), CancellationToken.None));

        Assert.Equal(AiFailureCategory.ProviderUnavailable, exception.Category);
        Assert.DoesNotContain("connection refused", exception.Message);
    }

    [Fact]
    public async Task RefusedCredentialsHideAi()
    {
        var options = new PerformanceAiOptions { ApiKey = "key" };
        var provider = new PerformanceAiProvider(
            Client(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized)),
            options, new AiAvailability(true));

        await Assert.ThrowsAsync<AiProviderException>(() => provider.CompleteAsync(Request(), CancellationToken.None));

        Assert.False(provider.IsAvailable);
    }

    [Fact]
    public async Task FailedWarmUpNeitherThrowsNorRestsAi()
    {
        var options = new PerformanceAiOptions { ApiKey = "key" };
        var calls = 0;
        var provider = new PerformanceAiProvider(
            Client(_ => { calls++; return new HttpResponseMessage(HttpStatusCode.Unauthorized); }),
            options, new AiAvailability(true));

        await provider.WarmUpAsync(Request(), CancellationToken.None);

        Assert.Equal(1, calls);
        Assert.True(provider.IsAvailable);
    }

    [Fact]
    public async Task WarmUpWithoutKeyStaysHome()
    {
        var calls = 0;
        var provider = new PerformanceAiProvider(
            Client(_ => { calls++; return new HttpResponseMessage(HttpStatusCode.OK); }),
            new PerformanceAiOptions(), new AiAvailability(false));

        await provider.WarmUpAsync(Request(), CancellationToken.None);

        Assert.Equal(0, calls);
    }

    [Theory]
    [InlineData("Performance:Ai:Endpoint", "http://example.com/v1")]
    [InlineData("Performance:Ai:Provider", "OpenAI")]
    [InlineData("Performance:Ai:Model", " ")]
    [InlineData("Performance:Ai:TimeoutSeconds", "0")]
    public void InvalidConfigurationFailsAtStartup(string key, string value)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [key] = value }).Build();
        Assert.Throws<InvalidOperationException>(() => PerformanceAiOptions.From(configuration));
    }

    [Fact]
    public void KeyFallsBackToTheSharedVariable()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["GROQ_API_KEY"] = "shared" }).Build();
        var options = PerformanceAiOptions.From(configuration);
        Assert.Equal("shared", options.ApiKey);
        Assert.True(options.IsConfigured);
    }

    private static PerformanceAiRequest Request()
        => new("Answer.", new { }, "answer", new { type = "object" });

    private static HttpClient Client(Func<HttpRequestMessage, HttpResponseMessage> send)
        => new(new DelegateHandler(send)) { BaseAddress = GroqEndpoint.BaseAddress(GroqEndpoint.DefaultUrl) };

    private sealed class ManualClock : TimeProvider
    {
        private DateTimeOffset now = DateTimeOffset.Parse("2026-10-16T10:00:00Z");
        public override DateTimeOffset GetUtcNow() => now;
        public void Advance(TimeSpan by) => now += by;
    }

    private sealed class DelegateHandler(Func<HttpRequestMessage, HttpResponseMessage> send) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(send(request));
    }

    private sealed class HangingHandler : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            await Task.Delay(Timeout.Infinite, cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK);
        }
    }
}
