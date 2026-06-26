namespace EY.HRPlatform.Training.Features.Admin.Quiz;

/// <summary>A minimal chat-completions seam (US-8.2.5). Registered only when an LLM endpoint is configured.</summary>
public interface ILlmClient
{
    Task<string> CompleteAsync(
        string systemPrompt, string userMessage, CancellationToken cancellationToken,
        double temperature = 0.4, int maxTokens = 2048);
}
