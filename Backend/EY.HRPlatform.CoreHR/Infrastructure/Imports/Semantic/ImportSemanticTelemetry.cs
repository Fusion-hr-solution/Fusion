using System.Diagnostics.Metrics;

namespace EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;

/// <summary>
/// Production signals for semantic assistance, tagged by import domain. Counts and latencies
/// only; no source data, prompts or provider responses. The override counter is the key quality
/// signal: how often administrators change what assistance supplied.
/// </summary>
public sealed class ImportSemanticTelemetry
{
    private static readonly Meter Meter = new("EY.HRPlatform.CoreHR.ImportSemanticAssistance", "3.0.0");
    private static readonly Counter<long> NotNeeded = Meter.CreateCounter<long>("import.semantic.not_needed");
    private static readonly Counter<long> Runs = Meter.CreateCounter<long>("import.semantic.runs");
    private static readonly Counter<long> Outcomes = Meter.CreateCounter<long>("import.semantic.outcomes");
    private static readonly Counter<long> Retries = Meter.CreateCounter<long>("import.semantic.retries");
    private static readonly Counter<long> Reuses = Meter.CreateCounter<long>("import.semantic.reuse");
    private static readonly Counter<long> Overrides = Meter.CreateCounter<long>("import.semantic.overrides");
    private static readonly Histogram<double> Latency = Meter.CreateHistogram<double>("import.semantic.latency", "ms");
    private static readonly Histogram<long> Questions = Meter.CreateHistogram<long>("import.semantic.questions");
    private static readonly Histogram<long> Suggestions = Meter.CreateHistogram<long>("import.semantic.suggestions");
    private static readonly Histogram<long> Applied = Meter.CreateHistogram<long>("import.semantic.applied");
    private static readonly Histogram<long> Abstentions = Meter.CreateHistogram<long>("import.semantic.abstentions");
    private static readonly Histogram<long> Rejected = Meter.CreateHistogram<long>("import.semantic.rejected");

    public static ImportSemanticTelemetry Organization { get; } = new("organization");
    public static ImportSemanticTelemetry Workforce { get; } = new("workforce");

    private readonly string domain;

    private ImportSemanticTelemetry(string domain) => this.domain = domain;

    public void RecordNotNeeded() => NotNeeded.Add(1, new KeyValuePair<string, object?>("domain", domain));

    public void RecordRun(string provider, string model, ImportSemanticTrigger trigger, int questions)
    {
        var tags = Tags(provider, model, ("trigger", trigger.ToString()));
        Runs.Add(1, tags);
        Questions.Record(questions, tags);
    }

    public void RecordReuse() => Reuses.Add(1, new KeyValuePair<string, object?>("domain", domain));

    public void RecordRetry(string provider, string model, ImportSemanticFailureCategory category)
        => Retries.Add(1, Tags(provider, model, ("category", category.ToString())));

    public void RecordSuccess(string provider, string model, double milliseconds, ImportSemanticRunOutcome outcome, int retries, bool reused)
    {
        var tags = Tags(provider, model, ("result", "succeeded"), ("reused", reused));
        Outcomes.Add(1, tags);
        Latency.Record(milliseconds, tags);
        Suggestions.Record(outcome.Returned, tags);
        Applied.Record(outcome.Applied.Count, tags);
        Abstentions.Record(outcome.Abstentions, tags);
        Rejected.Record(outcome.Rejected, tags);
    }

    public void RecordFailure(string provider, string model, double milliseconds, ImportSemanticFailureCategory category)
    {
        var tags = Tags(provider, model, ("result", "failed"), ("category", category.ToString()));
        Outcomes.Add(1, tags);
        Latency.Record(milliseconds, tags);
    }

    /// <summary>Overrides broken down by semantic target kind (ordinary field, identity field, reference field, vocabulary).</summary>
    public void RecordOverrides(string provider, string model, int count, string? targetKind = null)
        => Overrides.Add(count, Tags(provider, model, ("target", targetKind ?? "any")));

    private KeyValuePair<string, object?>[] Tags(string provider, string model, params (string Key, object? Value)[] extra)
        => [new("domain", domain), new("provider", provider), new("model", model), .. extra.Select(item => new KeyValuePair<string, object?>(item.Key, item.Value))];
}
