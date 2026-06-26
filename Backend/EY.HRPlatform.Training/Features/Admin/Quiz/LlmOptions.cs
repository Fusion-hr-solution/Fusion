namespace EY.HRPlatform.Training.Features.Admin.Quiz;

/// <summary>
/// Configuration for the Training-local LLM client (US-8.2.5, ADR 0009). Bound from "Training:Llm".
/// Targets any OpenAI-compatible chat-completions endpoint (e.g. opencode GO hosting DeepSeek/Qwen);
/// swapping models/providers is config-only. When BaseUrl or ApiKey is absent the client is not
/// registered and AI quiz generation is disabled.
/// </summary>
public class LlmOptions
{
    public string? BaseUrl { get; set; }
    public string? ApiKey { get; set; }
    public string Model { get; set; } = "deepseek-chat";
    public string Path { get; set; } = "/v1/chat/completions";
}
