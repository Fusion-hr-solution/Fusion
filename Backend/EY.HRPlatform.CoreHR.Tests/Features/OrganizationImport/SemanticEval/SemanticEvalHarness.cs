using EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;
using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.OrganizationImport;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport.SemanticEval;

public sealed record SemanticEvalCorpus(int Version, string Notes, IReadOnlyList<SemanticEvalCase> Cases)
{
    public static SemanticEvalCorpus Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Features", "OrganizationImport", "SemanticEval", "corpus.json");
        return JsonSerializer.Deserialize<SemanticEvalCorpus>(File.ReadAllText(path), new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? throw new InvalidOperationException("The semantic evaluation corpus could not be read.");
    }
}

public sealed record SemanticEvalCase(
    string Name,
    string About,
    IReadOnlyList<string> Headers,
    IReadOnlyList<IReadOnlyList<string>> Rows,
    SemanticEvalExpectations Expect);

public sealed record SemanticEvalExpectations(
    IReadOnlyDictionary<string, string>? Fields,
    IReadOnlyDictionary<string, string>? Types,
    string? Shape);

public enum SemanticEvalVerdict
{
    CorrectSuggestion,
    WrongSuggestion,
    CorrectAbstention,
    Missed,
    Unlabeled,
}

public sealed record SemanticEvalQuestionResult(string Question, string Expected, string Actual, SemanticEvalVerdict Verdict);

public sealed record SemanticEvalCaseResult(
    string Case,
    ImportSemanticAttemptStatus? RunStatus,
    ImportSemanticFailureCategory? Failure,
    int? LatencyMs,
    int Retries,
    IReadOnlyList<SemanticEvalQuestionResult> Questions,
    int DeterministicCorrect,
    int DeterministicTotal)
{
    public int Count(SemanticEvalVerdict verdict) => Questions.Count(item => item.Verdict == verdict);
}

public sealed record SemanticEvalReport(string Model, IReadOnlyList<SemanticEvalCaseResult> Cases)
{
    private int Sum(SemanticEvalVerdict verdict) => Cases.Sum(item => item.Count(verdict));

    public int Correct => Sum(SemanticEvalVerdict.CorrectSuggestion);
    public int Wrong => Sum(SemanticEvalVerdict.WrongSuggestion);
    public int CorrectAbstentions => Sum(SemanticEvalVerdict.CorrectAbstention);
    public int Missed => Sum(SemanticEvalVerdict.Missed);
    public int Runs => Cases.Count(item => item.RunStatus is not null);
    public int InvalidOutputs => Cases.Count(item => item.Failure == ImportSemanticFailureCategory.InvalidOutput);
    public int Failures => Cases.Count(item => item.RunStatus == ImportSemanticAttemptStatus.Failed);

    /// <summary>Of the suggestions that reached the Mapping Plan, how many were right. The headline metric.</summary>
    public double Precision => Ratio(Correct, Correct + Wrong);
    /// <summary>Of the questions with a right answer, how many were answered.</summary>
    public double Coverage => Ratio(Correct, Correct + Missed);
    /// <summary>Of the questions where abstaining is right, how many were abstained on.</summary>
    public double AbstentionAccuracy => Ratio(CorrectAbstentions, CorrectAbstentions + Cases.Sum(item => item.Questions.Count(q =>
        q.Verdict == SemanticEvalVerdict.WrongSuggestion && q.Expected == SemanticEvalHarness.Abstain)));

    public string ToMarkdown(DateTimeOffset at)
    {
        var latencies = Cases.Where(item => item.LatencyMs is not null).Select(item => item.LatencyMs!.Value).Order().ToList();
        var builder = new StringBuilder();
        builder.AppendLine(CultureInfo.InvariantCulture, $"# Semantic assistance evaluation: {Model}");
        builder.AppendLine();
        builder.AppendLine(CultureInfo.InvariantCulture, $"Run {at:yyyy-MM-dd HH:mm} UTC. Prompt `{OrganizationImportSemanticVersions.Prompt}`, result contract `{OrganizationImportSemanticVersions.ResultContract}`, data contract `{OrganizationImportSemanticVersions.DataContract}`.");
        builder.AppendLine();
        builder.AppendLine("| Metric | Value |");
        builder.AppendLine("| --- | --- |");
        builder.AppendLine(CultureInfo.InvariantCulture, $"| Precision (applied suggestions that are right) | {Precision:P0} ({Correct}/{Correct + Wrong}) |");
        builder.AppendLine(CultureInfo.InvariantCulture, $"| Wrong suggestions applied | {Wrong} |");
        builder.AppendLine(CultureInfo.InvariantCulture, $"| Coverage (answerable questions answered) | {Coverage:P0} ({Correct}/{Correct + Missed}) |");
        builder.AppendLine(CultureInfo.InvariantCulture, $"| Correct abstentions | {AbstentionAccuracy:P0} ({CorrectAbstentions}) |");
        builder.AppendLine(CultureInfo.InvariantCulture, $"| Runs / failed / invalid output | {Runs} / {Failures} / {InvalidOutputs} |");
        builder.AppendLine(CultureInfo.InvariantCulture, $"| Latency p50 / p95 | {Percentile(latencies, 0.5)} ms / {Percentile(latencies, 0.95)} ms |");
        builder.AppendLine(CultureInfo.InvariantCulture, $"| Deterministic expectations met | {Cases.Sum(item => item.DeterministicCorrect)}/{Cases.Sum(item => item.DeterministicTotal)} |");
        builder.AppendLine();
        foreach (var result in Cases)
        {
            builder.AppendLine(CultureInfo.InvariantCulture, $"## {result.Case}");
            builder.AppendLine();
            builder.AppendLine(CultureInfo.InvariantCulture,
                $"Run: {result.RunStatus?.ToString() ?? "not needed"}{(result.Failure is null ? "" : $" ({result.Failure})")}, latency {result.LatencyMs?.ToString(CultureInfo.InvariantCulture) ?? "-"} ms, retries {result.Retries}, deterministic {result.DeterministicCorrect}/{result.DeterministicTotal}.");
            if (result.Questions.Count == 0)
            {
                builder.AppendLine();
                continue;
            }
            builder.AppendLine();
            builder.AppendLine("| Question | Expected | Applied | Verdict |");
            builder.AppendLine("| --- | --- | --- | --- |");
            foreach (var question in result.Questions)
                builder.AppendLine(CultureInfo.InvariantCulture, $"| {question.Question} | {question.Expected} | {question.Actual} | {question.Verdict} |");
            builder.AppendLine();
        }
        return builder.ToString();
    }

    private static double Ratio(int numerator, int denominator) => denominator == 0 ? 1 : (double)numerator / denominator;

    private static string Percentile(IReadOnlyList<int> sorted, double percentile)
        => sorted.Count == 0 ? "-" : sorted[(int)Math.Min(sorted.Count - 1, Math.Ceiling(percentile * sorted.Count) - 1)].ToString(CultureInfo.InvariantCulture);
}

/// <summary>
/// Runs each corpus case through the real interpreter, context builder, validator and apply
/// path, with a pluggable provider, and scores what actually landed in the Mapping Plan.
/// </summary>
public static class SemanticEvalHarness
{
    public const string Abstain = "abstain";
    private static readonly DateOnly EffectiveDate = new(2026, 9, 1);

    public static async Task<SemanticEvalReport> RunAsync(
        SemanticEvalCorpus corpus,
        Func<SemanticEvalCase, IOrganizationImportSemanticProvider> providerFactory,
        OrganizationImportSemanticAssistanceOptions options,
        TimeSpan? pauseBetweenCases = null)
    {
        var results = new List<SemanticEvalCaseResult>();
        string? model = null;
        foreach (var evalCase in corpus.Cases)
        {
            var provider = providerFactory(evalCase);
            model ??= provider.ModelName;
            results.Add(await RunCaseAsync(evalCase, provider, options));
            if (pauseBetweenCases is { } pause) await Task.Delay(pause);
        }
        return new SemanticEvalReport(model ?? "none", results);
    }

    private static async Task<SemanticEvalCaseResult> RunCaseAsync(
        SemanticEvalCase evalCase,
        IOrganizationImportSemanticProvider provider,
        OrganizationImportSemanticAssistanceOptions options)
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        context.OrganizationalUnitTypes.AddRange(OrganizationalUnitTypeCatalog.BuiltIns.Select(type => OrganizationalUnitType.CreateBuiltIn(type.Id, type.Name)));
        context.ImportSemanticConsents.Add(ImportSemanticConsent.Grant(
            tenant.TenantId, provider.ProviderName, OrganizationImportSemanticVersions.DataContract, new(Guid.NewGuid(), "Evaluator")));
        var session = CreateSession(tenant.TenantId, evalCase);
        context.OrganizationImportSessions.Add(session);
        await context.SaveChangesAsync();

        var interpreter = new OrganizationImportInterpreter(context, tenant);
        var review = await interpreter.InterpretAsync(session, CancellationToken.None);
        var builder = new OrganizationImportSemanticContextBuilder(options);
        var request = builder.Build(session, review).Request;
        var (deterministicCorrect, deterministicTotal) = ScoreDeterministic(evalCase, review, request);
        if (request is null)
            return new(evalCase.Name, null, null, null, 0, [], deterministicCorrect, deterministicTotal);

        var service = new OrganizationImportSemanticAssistanceService(
            context, tenant, interpreter, builder, provider, options,
            NullLogger<OrganizationImportSemanticAssistanceService>.Instance);
        var stopwatch = Stopwatch.StartNew();
        await service.RunAfterUploadAsync(session.Id, new(Guid.NewGuid(), "Evaluator"), CancellationToken.None);
        stopwatch.Stop();
        context.ChangeTracker.Clear();
        var attempt = await context.OrganizationImportSemanticAttempts.AsNoTracking().SingleOrDefaultAsync();
        var applied = (attempt?.AppliedSuggestions() ?? []).ToDictionary(item => item.QuestionKey, item => item.TargetKey, StringComparer.Ordinal);

        var questions = request.Issues.Select(issue =>
        {
            var expected = Expected(evalCase, issue);
            var actual = applied.TryGetValue(issue.Key, out var target) ? Meaning(issue, target, request) : Abstain;
            var verdict = expected is null ? SemanticEvalVerdict.Unlabeled
                : expected == Abstain
                    ? actual == Abstain ? SemanticEvalVerdict.CorrectAbstention : SemanticEvalVerdict.WrongSuggestion
                    : actual == Abstain ? SemanticEvalVerdict.Missed
                    : string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase) ? SemanticEvalVerdict.CorrectSuggestion
                    : SemanticEvalVerdict.WrongSuggestion;
            return new SemanticEvalQuestionResult($"{issue.Kind}: {issue.SourceLabel ?? "shape"}", expected ?? "-", actual, verdict);
        }).ToList();
        return new(evalCase.Name, attempt?.Status, attempt?.FailureCategory, attempt?.LatencyMilliseconds ?? (int)stopwatch.ElapsedMilliseconds,
            attempt?.RetryCount ?? 0, questions, deterministicCorrect, deterministicTotal);
    }

    /// <summary>The ground-truth meaning for a question, or null when the corpus does not label it.</summary>
    public static string? Expected(SemanticEvalCase evalCase, ImportSemanticIssue issue)
        => issue.Kind switch
        {
            OrganizationImportSemanticKinds.FieldMapping => Lookup(evalCase.Expect.Fields, issue.SourceLabel),
            OrganizationImportSemanticKinds.OrganizationTypeMapping => Lookup(evalCase.Expect.Types, issue.SourceLabel),
            OrganizationImportSemanticKinds.SourceShape => evalCase.Expect.Shape,
            _ => null,
        };

    /// <summary>A target key in the corpus's vocabulary: a field key, a type name or a shape.</summary>
    public static string Meaning(ImportSemanticIssue issue, string targetKey, OrganizationImportSemanticRequest request)
    {
        if (targetKey.StartsWith("field:", StringComparison.Ordinal)) return targetKey["field:".Length..];
        if (targetKey.StartsWith("shape:", StringComparison.Ordinal)) return targetKey["shape:".Length..];
        if (targetKey.StartsWith("type:", StringComparison.Ordinal)
            && Guid.TryParse(targetKey["type:".Length..], out var typeId))
            return request.OrganizationTypes.FirstOrDefault(type => type.Id == typeId)?.Name ?? targetKey;
        return issue.AllowedTargets.FirstOrDefault(target => target.Key == targetKey)?.Label ?? targetKey;
    }

    /// <summary>The allowed target that carries the expected meaning, if any.</summary>
    public static string? TargetFor(ImportSemanticIssue issue, string expected, OrganizationImportSemanticRequest request)
        => issue.AllowedTargets.FirstOrDefault(target =>
            string.Equals(Meaning(issue, target.Key, request), expected, StringComparison.OrdinalIgnoreCase))?.Key;

    private static (int Correct, int Total) ScoreDeterministic(
        SemanticEvalCase evalCase,
        OrganizationImportInterpretation review,
        OrganizationImportSemanticRequest? request)
    {
        var asked = request?.Issues.Select(issue => issue.SourceLabel ?? "shape").ToHashSet(StringComparer.OrdinalIgnoreCase) ?? [];
        var plan = review.MappingPlan;
        if (plan is null) return (0, 0);
        var correct = 0;
        var total = 0;
        foreach (var (header, expected) in evalCase.Expect.Fields ?? new Dictionary<string, string>())
        {
            if (asked.Contains(header)) continue;
            var column = evalCase.Headers.ToList().IndexOf(header);
            var mapped = plan.ColumnMappings.FirstOrDefault(mapping => mapping.ColumnIndex == column)?.Field ?? Abstain;
            total++;
            if (string.Equals(mapped, expected, StringComparison.OrdinalIgnoreCase)) correct++;
        }
        foreach (var (label, expected) in evalCase.Expect.Types ?? new Dictionary<string, string>())
        {
            if (asked.Contains(label)) continue;
            var detail = plan.TypeMappingDetails?.FirstOrDefault(item => string.Equals(item.SourceValue, label, StringComparison.OrdinalIgnoreCase));
            if (detail is null) continue;
            total++;
            if (string.Equals(detail.TypeName ?? Abstain, expected, StringComparison.OrdinalIgnoreCase)) correct++;
        }
        return (correct, total);
    }

    private static string? Lookup(IReadOnlyDictionary<string, string>? map, string? key)
        => map is null || key is null ? null
            : map.FirstOrDefault(item => string.Equals(item.Key, key, StringComparison.OrdinalIgnoreCase)).Value;

    private static OrganizationImportSession CreateSession(Guid tenantId, SemanticEvalCase evalCase)
    {
        var table = new OrganizationSourceTable(
            evalCase.Headers.Select((header, index) => new OrganizationSourceColumn(index, header)).ToList(),
            evalCase.Rows.Select(row => (IReadOnlyList<string?>)row.Select(value => string.IsNullOrWhiteSpace(value) ? null : value).ToList()).ToList());
        var session = OrganizationImportSession.Create(tenantId, EffectiveDate, Guid.NewGuid(), new string('e', 64), new(Guid.NewGuid(), "Evaluator"));
        var hash = Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(evalCase.Name)));
        session.AttachSource(OrganizationImportSource.Create(tenantId, session.Id,
            new InspectedOrganizationSource($"{evalCase.Name}.csv", "csv", "text/csv", hash, "CSV",
                $"A1:{(char)('A' + evalCase.Headers.Count - 1)}{evalCase.Rows.Count + 1}", table, Encoding.UTF8.GetBytes(evalCase.Name))));
        return session;
    }
}
