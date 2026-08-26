namespace EY.HRPlatform.Interview.Features.Grading.Groq;

/// <summary>
/// Tuning knobs for the self-consistency ("triple check") AI grader.
/// Bound from the <c>Groq:Grading</c> configuration section.
/// </summary>
public sealed class GroqGradingOptions
{
    public const string SectionName = "Groq:Grading";

    /// <summary>How many independent grading passes to run per question (min 1).</summary>
    public int PassCount { get; set; } = 3;

    /// <summary>
    /// If the passes' scores (on a 0–10 scale) spread by more than this, the model
    /// is considered inconsistent and the question is flagged for human review.
    /// </summary>
    public double MaxScoreSpread { get; set; } = 2.5;

    /// <summary>Average self-reported confidence below which a question is flagged for review.</summary>
    public double LowConfidenceThreshold { get; set; } = 0.7;

    /// <summary>Sampling temperature for each pass — high enough to make passes genuinely independent.</summary>
    public double PassTemperature { get; set; } = 0.4;

    /// <summary>
    /// Completion budget per pass. On a reasoning model this covers the thinking
    /// tokens as well as the verdict, so it has to leave room for both: too low and
    /// the pass is truncated before the JSON arrives and the question is needlessly
    /// flagged for human review.
    /// </summary>
    public int MaxCompletionTokens { get; set; } = 1536;
}
