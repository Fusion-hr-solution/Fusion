namespace EY.HRPlatform.Training.Features.Admin.Quiz;

/// <summary>
/// Configuration for the Training-local opencode GO quiz client (US-8.2.5, ADR 0009). Bound from
/// "Training:OpenCode". Targets the opencode GO ("zen go") chat-completions endpoint; prefer a
/// non-reasoning model so the JSON fits the token budget (e.g. deepseek-v4-flash, qwen3.7-plus, glm-5).
/// When BaseUrl or ApiKey is absent the client is not registered and AI quiz generation is disabled.
/// </summary>
public class OpenCodeGoOptions
{
    /// <summary>Origin only, e.g. "https://opencode.ai" — the absolute <see cref="Path"/> replaces any base path.</summary>
    public string? BaseUrl { get; set; }
    public string? ApiKey { get; set; }
    /// <summary>
    /// The BARE model id as listed by /zen/go/v1/models (e.g. "deepseek-v4-flash"). Do NOT use the
    /// "opencode-go/&lt;model&gt;" CLI-config prefix — the HTTP API rejects it with a 401 ModelError.
    /// </summary>
    public string Model { get; set; } = "glm-5.2";
    public string Path { get; set; } = "/zen/go/v1/chat/completions";
}
