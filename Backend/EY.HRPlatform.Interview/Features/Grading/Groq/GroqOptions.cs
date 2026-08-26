namespace EY.HRPlatform.Interview.Features.Grading.Groq;

/// <summary>
/// Model selection for every Groq call (grading and question generation).
/// Bound from the <c>Groq</c> configuration section.
/// </summary>
/// <remarks>
/// Kept in configuration deliberately: Groq retires models on a published
/// schedule (llama-3.3-70b-versatile was decommissioned on 2026-08-16), so the
/// next migration should be an appsettings change rather than a redeploy.
/// </remarks>
public sealed class GroqOptions
{
    public const string SectionName = "Groq";

    /// <summary>Groq model ID used for all chat completions.</summary>
    public string Model { get; set; } = "openai/gpt-oss-120b";

    /// <summary>
    /// How much the model thinks before answering: <c>low</c>, <c>medium</c> or
    /// <c>high</c>. Reasoning is billed and counted as output, so this is the main
    /// cost/latency knob — <c>low</c> is plenty for grading and drafting.
    /// Set to empty to target a non-reasoning model: the reasoning parameters are
    /// then omitted from the request entirely.
    /// </summary>
    public string ReasoningEffort { get; set; } = "low";

    /// <summary>True when <see cref="Model"/> is a reasoning model, i.e. an effort level is configured.</summary>
    public bool IsReasoningModel => !string.IsNullOrWhiteSpace(ReasoningEffort);
}
