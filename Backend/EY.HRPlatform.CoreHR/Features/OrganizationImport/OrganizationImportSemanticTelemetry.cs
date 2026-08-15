using System.Diagnostics.Metrics;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

internal static class OrganizationImportSemanticTelemetry
{
    private static readonly Meter Meter = new("EY.HRPlatform.CoreHR.OrganizationImportSemanticAssistance", "1.0.0");
    private static readonly Counter<long> Eligibility = Meter.CreateCounter<long>("organization_import.semantic.eligibility");
    private static readonly Counter<long> Attempts = Meter.CreateCounter<long>("organization_import.semantic.attempts");
    private static readonly Counter<long> Reuse = Meter.CreateCounter<long>("organization_import.semantic.reuse");
    private static readonly Counter<long> ValidationRejections = Meter.CreateCounter<long>("organization_import.semantic.validation_rejections");
    private static readonly Counter<long> ReviewDispositions = Meter.CreateCounter<long>("organization_import.semantic.review_dispositions");
    private static readonly Counter<long> ApplyConflicts = Meter.CreateCounter<long>("organization_import.semantic.apply_conflicts");
    private static readonly Counter<long> Applications = Meter.CreateCounter<long>("organization_import.semantic.applications");
    private static readonly Histogram<double> ProviderLatency = Meter.CreateHistogram<double>("organization_import.semantic.provider_latency", "ms");

    public static void RecordEligibility(string outcome)
        => Eligibility.Add(1, new KeyValuePair<string, object?>("outcome", outcome));

    public static void RecordAttempt(string provider, string model)
        => Attempts.Add(1, Tags(provider, model));

    public static void RecordReuse(string status)
        => Reuse.Add(1, new KeyValuePair<string, object?>("status", status));

    public static void RecordProviderResult(string provider, string model, double milliseconds, string result, int rejected)
    {
        var tags = Tags(provider, model, result);
        ProviderLatency.Record(milliseconds, tags);
        if (rejected > 0) ValidationRejections.Add(rejected, tags);
    }

    public static void RecordFailure(string provider, string model, double milliseconds, OrganizationImportSemanticFailureCategory category)
        => ProviderLatency.Record(milliseconds, Tags(provider, model, category.ToString()));

    public static void RecordDisposition(OrganizationImportSemanticReviewOutcome outcome)
        => ReviewDispositions.Add(1, new KeyValuePair<string, object?>("outcome", outcome.ToString()));

    public static void RecordApplyConflict() => ApplyConflicts.Add(1);
    public static void RecordApplication() => Applications.Add(1);

    private static KeyValuePair<string, object?>[] Tags(string provider, string model, string? result = null)
        => result is null
            ? [new("provider", provider), new("model", model)]
            : [new("provider", provider), new("model", model), new("result", result)];
}
