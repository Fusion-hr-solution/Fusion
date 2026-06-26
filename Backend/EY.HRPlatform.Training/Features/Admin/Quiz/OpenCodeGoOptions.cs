namespace EY.HRPlatform.Training.Features.Admin.Quiz;

/// <summary>
/// Configuration for the Training-local opencode GO quiz client (US-8.2.5, ADR 0009). Bound from
/// "Training:OpenCode". Targets the opencode GO ("zen go") chat-completions endpoint hosting DeepSeek
/// or Qwen models; the model is config-only (e.g. opencode-go/deepseek-v4-pro, opencode-go/qwen3.7-plus).
/// When BaseUrl or ApiKey is absent the client is not registered and AI quiz generation is disabled.
/// </summary>
public class OpenCodeGoOptions
{
    /// <summary>Origin only, e.g. "https://opencode.ai" — the absolute <see cref="Path"/> replaces any base path.</summary>
    public string? BaseUrl { get; set; }
    public string? ApiKey { get; set; }
    /// <summary>opencode GO model id, format "opencode-go/&lt;model&gt;".</summary>
    public string Model { get; set; } = "opencode-go/deepseek-v4-pro";
    public string Path { get; set; } = "/zen/go/v1/chat/completions";
}
