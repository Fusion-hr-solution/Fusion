using EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;
using EY.HRPlatform.CoreHR.Features.OrganizationImport;
using Xunit.Abstractions;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport.SemanticEval;

/// <summary>
/// The semantic evaluation corpus. The offline tests keep the harness and the corpus honest on
/// every build; the live run measures a real model and is the regression gate for any change to
/// the model, prompt, result contract, context builder, taxonomy or validation rules.
/// </summary>
public sealed class SemanticEvalTests(ITestOutputHelper output)
{
    [Fact]
    public async Task Corpus_IsConsistent_AndAPerfectOracleScoresPerfectPrecision()
    {
        var corpus = SemanticEvalCorpus.Load();
        var report = await SemanticEvalHarness.RunAsync(corpus, evalCase => new ScriptedProvider(evalCase, oracle: true), Options());
        output.WriteLine(report.ToMarkdown(DateTimeOffset.UtcNow));

        // Every labelled question can be answered from its allowed targets, so the ground truth
        // never asks for a meaning Fusion cannot express.
        Assert.DoesNotContain(report.Cases.SelectMany(item => item.Questions), question => question.Verdict == SemanticEvalVerdict.Unlabeled);
        Assert.Equal(0, report.Wrong);
        Assert.Equal(1, report.Precision);
        Assert.Equal(1, report.AbstentionAccuracy);
        Assert.Equal(0, report.Failures);
        // The Fusion template never reaches the provider.
        Assert.Null(report.Cases.Single(item => item.Case == "fusion-template").RunStatus);
        // The demo file asks its vocabulary and abstains on the ambiguous label.
        var demo = report.Cases.Single(item => item.Case == "lumera-custom-vocabulary");
        Assert.Contains(demo.Questions, question => question.Question.EndsWith("Shared Service", StringComparison.Ordinal)
            && question.Verdict == SemanticEvalVerdict.CorrectAbstention);
    }

    [Fact]
    public async Task Scoring_CountsConfidentGuessesAsWrong()
    {
        var corpus = SemanticEvalCorpus.Load();
        var report = await SemanticEvalHarness.RunAsync(corpus, evalCase => new ScriptedProvider(evalCase, oracle: false), Options());

        Assert.True(report.Wrong > 0);
        Assert.True(report.Precision < 1);
        // Where abstaining is right, the validator already discards this guesser's answers (a field
        // can be claimed once; collapsed type systems are withheld), so abstention accuracy holds.
        Assert.Equal(1, report.AbstentionAccuracy);
    }

    [SemanticEvalFact]
    public async Task LiveModels_AreMeasuredOnTheCorpus()
    {
        var corpus = SemanticEvalCorpus.Load();
        var models = (Environment.GetEnvironmentVariable("FUSION_SEMANTIC_EVAL_MODELS") ?? OrganizationImportSemanticAssistanceOptions.DefaultModel)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var model in models)
        {
            var options = Options();
            options.Model = model;
            options.ApiKey = Environment.GetEnvironmentVariable("GROQ_API_KEY");
            options.TimeoutSeconds = 30;
            options.UploadBudgetSeconds = 60;
            var report = await SemanticEvalHarness.RunAsync(corpus, _ =>
                new GroqOrganizationImportSemanticProvider(
                    new HttpClient { BaseAddress = new Uri("https://api.groq.com/openai/v1/"), Timeout = Timeout.InfiniteTimeSpan },
                    options), options, pauseBetweenCases: TimeSpan.FromSeconds(PauseSeconds()));
            var at = DateTimeOffset.UtcNow;
            var markdown = report.ToMarkdown(at);
            output.WriteLine(markdown);
            var directory = ReportDirectory();
            Directory.CreateDirectory(directory);
            await File.WriteAllTextAsync(Path.Combine(directory, $"{at:yyyy-MM-dd-HHmm}-{model.Replace('/', '_')}.md"), markdown);
            Assert.True(report.Runs > 0, "The corpus must reach the provider.");
        }
    }

    // Provider token budgets are per minute; space the cases so the run measures the model, not throttling.
    private static int PauseSeconds()
        => int.TryParse(Environment.GetEnvironmentVariable("FUSION_SEMANTIC_EVAL_PAUSE_SECONDS"), out var seconds) ? seconds : 20;

    private static OrganizationImportSemanticAssistanceOptions Options()
        => new() { ApiKey = "offline", TimeoutSeconds = 10, UploadBudgetSeconds = 10, MaxRetries = 1 };

    private static string ReportDirectory()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !Directory.Exists(Path.Combine(directory.FullName, ".local-docs")))
            directory = directory.Parent;
        return directory is null
            ? Path.Combine(AppContext.BaseDirectory, "semantic-eval")
            : Path.Combine(directory.FullName, ".local-docs", "Core", "semantic-eval");
    }

    /// <summary>
    /// Answers from the corpus: the oracle gives the ground truth (abstaining where it says so);
    /// the guesser always suggests the first allowed target, which is what a careless model does.
    /// </summary>
    private sealed class ScriptedProvider(SemanticEvalCase evalCase, bool oracle) : IOrganizationImportSemanticProvider
    {
        public string ProviderName => OrganizationImportSemanticAssistanceOptions.DefaultProvider;
        public string ModelName => oracle ? "scripted-oracle" : "scripted-guesser";
        public bool IsConfigured => true;

        public Task<ImportSemanticProviderResult> SuggestAsync(OrganizationImportSemanticRequest request, CancellationToken cancellationToken)
        {
            var answers = request.Issues.Select(issue =>
            {
                if (!oracle)
                    return new ImportSemanticAnswer(issue.Key, ImportSemanticDisposition.Suggest, issue.AllowedTargets[0].Key);
                var expected = SemanticEvalHarness.Expected(evalCase, issue);
                var target = expected is null || expected == SemanticEvalHarness.Abstain ? null : SemanticEvalHarness.TargetFor(issue, expected, request);
                return target is null
                    ? new ImportSemanticAnswer(issue.Key, ImportSemanticDisposition.Abstain, null)
                    : new ImportSemanticAnswer(issue.Key, ImportSemanticDisposition.Suggest, target);
            }).ToList();
            return Task.FromResult(new ImportSemanticProviderResult(answers, null, null));
        }
    }
}

[AttributeUsage(AttributeTargets.Method)]
internal sealed class SemanticEvalFactAttribute : FactAttribute
{
    public SemanticEvalFactAttribute()
    {
        if (Environment.GetEnvironmentVariable("FUSION_SEMANTIC_EVAL") != "1"
            || string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("GROQ_API_KEY")))
            Skip = "Set FUSION_SEMANTIC_EVAL=1 and GROQ_API_KEY (optionally FUSION_SEMANTIC_EVAL_MODELS=a,b) to measure live models.";
    }
}
