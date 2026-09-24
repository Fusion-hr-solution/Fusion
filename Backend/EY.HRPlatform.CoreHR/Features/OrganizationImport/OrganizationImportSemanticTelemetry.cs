using System.Diagnostics.Metrics;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

/// <summary>
/// Production signals for semantic assistance. Counts and latencies only; no source data,
/// prompts or provider responses. The override counter is the key quality signal: how often
/// administrators change what assistance supplied.
/// </summary>
internal static class OrganizationImportSemanticTelemetry
{
    private static readonly Meter Meter = new("EY.HRPlatform.CoreHR.OrganizationImportSemanticAssistance", "2.0.0");
    private static readonly Counter<long> NotNeeded = Meter.CreateCounter<long>("organization_import.semantic.not_needed");
    private static readonly Counter<long> Runs = Meter.CreateCounter<long>("organization_import.semantic.runs");
    private static readonly Counter<long> Outcomes = Meter.CreateCounter<long>("organization_import.semantic.outcomes");
    private static readonly Counter<long> Retries = Meter.CreateCounter<long>("organization_import.semantic.retries");
    private static readonly Counter<long> Reuses = Meter.CreateCounter<long>("organization_import.semantic.reuse");
    private static readonly Counter<long> Overrides = Meter.CreateCounter<long>("organization_import.semantic.overrides");
    private static readonly Histogram<double> Latency = Meter.CreateHistogram<double>("organization_import.semantic.latency", "ms");
    private static readonly Histogram<long> Questions = Meter.CreateHistogram<long>("organization_import.semantic.questions");
    private static readonly Histogram<long> Suggestions = Meter.CreateHistogram<long>("organization_import.semantic.suggestions");
    private static readonly Histogram<long> Applied = Meter.CreateHistogram<long>("organization_import.semantic.applied");
    private static readonly Histogram<long> Abstentions = Meter.CreateHistogram<long>("organization_import.semantic.abstentions");
    private static readonly Histogram<long> Rejected = Meter.CreateHistogram<long>("organization_import.semantic.rejected");

    public static void RecordNotNeeded() => NotNeeded.Add(1);

    public static void RecordRun(string provider, string model, OrganizationImportSemanticTrigger trigger, int questions)
    {
        var tags = Tags(provider, model, ("trigger", trigger.ToString()));
        Runs.Add(1, tags);
        Questions.Record(questions, tags);
    }

    public static void RecordReuse() => Reuses.Add(1);

    public static void RecordRetry(string provider, string model, OrganizationImportSemanticFailureCategory category)
        => Retries.Add(1, Tags(provider, model, ("category", category.ToString())));

    public static void RecordSuccess(
        string provider,
        string model,
        double milliseconds,
        OrganizationImportSemanticRunOutcome outcome,
        int retries,
        bool reused)
    {
        var tags = Tags(provider, model, ("result", "succeeded"), ("reused", reused));
        Outcomes.Add(1, tags);
        Latency.Record(milliseconds, tags);
        Suggestions.Record(outcome.Returned, tags);
        Applied.Record(outcome.Applied.Count, tags);
        Abstentions.Record(outcome.Abstentions, tags);
        Rejected.Record(outcome.Rejected, tags);
    }

    public static void RecordFailure(string provider, string model, double milliseconds, OrganizationImportSemanticFailureCategory category)
    {
        var tags = Tags(provider, model, ("result", "failed"), ("category", category.ToString()));
        Outcomes.Add(1, tags);
        Latency.Record(milliseconds, tags);
    }

    public static void RecordOverrides(string provider, string model, int count)
        => Overrides.Add(count, Tags(provider, model));

    private static KeyValuePair<string, object?>[] Tags(string provider, string model, params (string Key, object? Value)[] extra)
        => [new("provider", provider), new("model", model), .. extra.Select(item => new KeyValuePair<string, object?>(item.Key, item.Value))];
}
