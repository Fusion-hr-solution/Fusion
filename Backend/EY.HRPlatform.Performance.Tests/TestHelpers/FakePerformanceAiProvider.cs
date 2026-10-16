using System.Text.Json;
using EY.HRPlatform.Performance.Infrastructure.Ai;
using EY.HRPlatform.SharedKernel.Ai;

namespace EY.HRPlatform.Performance.Tests.TestHelpers;

/// <summary>A scripted AI provider: answers with <see cref="Answer"/>, or throws <see cref="Failure"/>, and records each request.</summary>
public sealed class FakePerformanceAiProvider : IPerformanceAiProvider
{
    public string ProviderName => "Groq";
    public string Model => "test-model";
    public bool IsAvailable { get; set; } = true;
    public object? Answer { get; set; }
    public AiProviderException? Failure { get; set; }
    public List<PerformanceAiRequest> Requests { get; } = [];
    public int UnusableAnswers { get; private set; }

    public Task<AiStructuredResult> CompleteAsync(PerformanceAiRequest request, CancellationToken cancellationToken)
    {
        Requests.Add(request);
        if (Failure is not null) throw Failure;
        var content = JsonSerializer.SerializeToElement(Answer ?? new { });
        return Task.FromResult(new AiStructuredResult(content, 10, 5, "resp", "fp"));
    }

    public void ReportUnusableAnswer() => UnusableAnswers++;

    public Task WarmUpAsync(PerformanceAiRequest request, CancellationToken cancellationToken) => Task.CompletedTask;
}
