namespace EY.HRPlatform.Training.Features.Admin.Quiz;

/// <summary>
/// A minimal chat-completions seam (US-8.2.5), implemented by the opencode GO client
/// (<see cref="OpenCodeGoLlmClient"/>). Registered only when opencode GO is configured.
/// </summary>
public interface ILlmClient
{
    Task<string> CompleteAsync(
        string systemPrompt, string userMessage, CancellationToken cancellationToken,
        double temperature = 0.4, int maxTokens = 2048);
}
