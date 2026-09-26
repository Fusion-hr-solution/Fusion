using System.Text;
using System.Text.Json;
using EY.HRPlatform.CoreHR.Features.Employees.Import;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;
using EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport.SemanticEval;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Xunit.Abstractions;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees.SemanticEval;

public sealed record WorkforceEvalCorpus(int Version, string Notes, IReadOnlyList<WorkforceEvalCase> Cases)
{
    public static WorkforceEvalCorpus Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Features", "Employees", "SemanticEval", "corpus.json");
        return JsonSerializer.Deserialize<WorkforceEvalCorpus>(File.ReadAllText(path), new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
    }
}

public sealed record WorkforceEvalCase(string Name, string About, IReadOnlyList<string> Headers, IReadOnlyList<IReadOnlyList<string>> Rows, WorkforceEvalExpect Expect);
public sealed record WorkforceEvalExpect(IReadOnlyDictionary<string, string> Fields, IReadOnlyDictionary<string, string> Statuses);

public sealed record WorkforceEvalResult(string Case, string Question, string Expected, string Actual, SemanticEvalVerdict Verdict);

/// <summary>
/// The Workforce semantic evaluation corpus. Offline, a perfect oracle must score perfectly (the
/// corpus and harness stay honest); live, a real model is measured for precision and abstention.
/// Precision matters more than coverage: a wrong identifier or manager meaning affects everyone.
/// </summary>
public sealed class WorkforceSemanticEvalTests(ITestOutputHelper output)
{
    private static readonly ImportActor Actor = new(Guid.NewGuid(), "Eval");

    [Fact]
    public async Task Corpus_is_consistent_and_a_perfect_oracle_scores_perfect_precision()
    {
        var results = await RunAsync(evalCase => new WorkforceImportTestKit.ScriptedProvider(request => Oracle(evalCase, request)));
        Write(results, "oracle");
        Assert.DoesNotContain(results, r => r.Verdict == SemanticEvalVerdict.Unlabeled);
        Assert.DoesNotContain(results, r => r.Verdict is SemanticEvalVerdict.WrongSuggestion or SemanticEvalVerdict.Missed);
        Assert.DoesNotContain(results, r => r.Case == "fusion-template"); // nothing asked
    }

    [Fact]
    public async Task Confident_guessing_is_scored_as_wrong()
    {
        var results = await RunAsync(_ => new WorkforceImportTestKit.ScriptedProvider(request => new ImportSemanticProviderResult(
            request.Questions.Select(q => new ImportSemanticAnswer(q.Key, ImportSemanticDisposition.Suggest, q.AllowedTargets[0].Key)).ToList(), null, null)));
        Assert.Contains(results, r => r.Verdict == SemanticEvalVerdict.WrongSuggestion);
    }

    [SemanticEvalFact]
    public async Task Live_model_is_measured_on_the_corpus()
    {
        var model = Environment.GetEnvironmentVariable("FUSION_SEMANTIC_EVAL_MODELS")?.Split(',')[0].Trim() ?? new WorkforceImportSemanticAssistanceOptions().Model;
        var options = new WorkforceImportSemanticAssistanceOptions { ApiKey = Environment.GetEnvironmentVariable("GROQ_API_KEY"), Model = model };
        var results = await RunAsync(_ => new GroqWorkforceImportSemanticProvider(
            new HttpClient { BaseAddress = new Uri(options.BaseUrl), Timeout = TimeSpan.FromSeconds(60) }, options), pauseSeconds: 15);
        Write(results, model);
        var suggestions = results.Where(r => r.Verdict is SemanticEvalVerdict.CorrectSuggestion or SemanticEvalVerdict.WrongSuggestion).ToList();
        var precision = suggestions.Count == 0 ? 1d : suggestions.Count(r => r.Verdict == SemanticEvalVerdict.CorrectSuggestion) / (double)suggestions.Count;
        Assert.True(precision >= 0.9, $"Precision {precision:P0} is below the 90% gate.");
    }

    private static async Task<List<WorkforceEvalResult>> RunAsync(Func<WorkforceEvalCase, IWorkforceImportSemanticProvider> providerFor, int pauseSeconds = 0)
    {
        var results = new List<WorkforceEvalResult>();
        foreach (var evalCase in WorkforceEvalCorpus.Load().Cases)
        {
            var tenant = Guid.NewGuid();
            await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenant), Guid.NewGuid().ToString());
            var provider = providerFor(evalCase);
            var sessions = new WorkforceImportSessionService(db, TestTenantContext.WithTenant(tenant), new SafeTabularSourceReader(),
                new WorkforceImportSourceAdapter(), WorkforceImportTestKit.Derivation(db, tenant),
                WorkforceImportTestKit.Semantic(db, tenant, provider,
                    new WorkforceImportSemanticAssistanceOptions { ConsentMode = ImportSemanticConsentMode.Implicit, MaxRetries = 1, UploadBudgetSeconds = 60, TimeoutSeconds = 45 }));
            var csv = string.Join('\n', new[] { string.Join(',', evalCase.Headers.Select(Quote)) }.Concat(evalCase.Rows.Select(r => string.Join(',', r.Select(Quote))))) + "\n";
            var outcome = await sessions.IntakeAsync(new WorkforceImportIntakeRequest(Guid.NewGuid(), new DateOnly(2026, 8, 17),
                new MemoryStream(Encoding.UTF8.GetBytes(csv)), $"{evalCase.Name}.csv", "text/csv", null, Actor), default);
            db.ChangeTracker.Clear();
            var session = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == outcome.Session!.Id);
            var attempt = await db.WorkforceImportSemanticAttempts.AsNoTracking().SingleOrDefaultAsync(a => a.SessionId == session.Id);
            if (attempt is null) continue;
            var plan = WorkforceImportMappingPlan.Parse(session.MappingPlanJson);
            foreach (var key in attempt.QuestionKeys())
            {
                string question, expected, actual;
                if (key.StartsWith("column:", StringComparison.Ordinal))
                {
                    var index = int.Parse(key["column:".Length..]);
                    question = evalCase.Headers[index];
                    expected = evalCase.Expect.Fields.GetValueOrDefault(question) ?? "";
                    actual = plan.ColumnOrigins.GetValueOrDefault(index) == ImportResolutionOrigin.SemanticSuggestion ? plan.ColumnMappings[index].ToString() : "Abstain";
                }
                else
                {
                    question = key["status:".Length..];
                    expected = evalCase.Expect.Statuses.GetValueOrDefault(question) ?? "";
                    actual = plan.VocabularyOrigins.GetValueOrDefault(question) == ImportResolutionOrigin.SemanticSuggestion ? plan.LifecycleVocabulary[question].ToString() : "Abstain";
                }
                results.Add(new WorkforceEvalResult(evalCase.Name, question, expected, actual, Verdict(expected, actual)));
            }
            if (pauseSeconds > 0) await Task.Delay(TimeSpan.FromSeconds(pauseSeconds));
        }
        return results;
    }

    private static SemanticEvalVerdict Verdict(string expected, string actual)
    {
        if (expected.Length == 0) return SemanticEvalVerdict.Unlabeled;
        var accepted = expected.Split('|');
        var abstainIsRight = accepted.Contains("Abstain");
        if (actual is "Abstain" or "Ignored")
            return abstainIsRight ? SemanticEvalVerdict.CorrectAbstention : SemanticEvalVerdict.Missed;
        return accepted.Contains(actual) ? SemanticEvalVerdict.CorrectSuggestion : SemanticEvalVerdict.WrongSuggestion;
    }

    private static ImportSemanticProviderResult Oracle(WorkforceEvalCase evalCase, WorkforceImportSemanticRequest request)
        => new(request.Questions.Select(q =>
        {
            var expected = q.Kind == WorkforceImportSemanticKinds.FieldMapping
                ? evalCase.Expect.Fields.GetValueOrDefault(evalCase.Headers[q.SourceColumnIndex!.Value])
                : evalCase.Expect.Statuses.GetValueOrDefault(q.Key["status:".Length..]);
            var first = expected?.Split('|')[0];
            if (first is null or "Abstain") return new ImportSemanticAnswer(q.Key, ImportSemanticDisposition.Abstain, null);
            var prefix = q.Kind == WorkforceImportSemanticKinds.FieldMapping ? "field:" : "lifecycle:";
            return new ImportSemanticAnswer(q.Key, ImportSemanticDisposition.Suggest, prefix + first);
        }).ToList(), null, null);

    private void Write(IReadOnlyList<WorkforceEvalResult> results, string label)
    {
        output.WriteLine($"## Workforce semantic eval · {label}");
        foreach (var r in results) output.WriteLine($"{r.Case} | {r.Question} | expected {r.Expected} | got {r.Actual} | {r.Verdict}");
    }

    private static string Quote(string value) => value.Contains(',') ? $"\"{value}\"" : value;
}
