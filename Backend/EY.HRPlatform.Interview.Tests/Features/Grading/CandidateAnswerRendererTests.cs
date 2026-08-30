using System.Text.Json;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Grading;
using EY.HRPlatform.Interview.Features.Grading.HumanReview;

namespace EY.HRPlatform.Interview.Tests.Features.Grading;

public class CandidateAnswerRendererTests
{
    [Fact]
    public void Render_PlainTextAnswer_IsUnchanged()
    {
        var result = CandidateAnswerRenderer.Render(
            new CandidateAnswer("REST is stateless because...", []), Question());

        Assert.Equal("REST is stateless because...", result);
    }

    [Fact]
    public void Render_SelectedOptions_ResolvesToOptionText()
    {
        var question = Question();
        var option = new QuestionOption { Text = "Paris", Correct = true };
        question.Options.Add(option);

        var result = CandidateAnswerRenderer.Render(
            new CandidateAnswer(string.Empty, [option.Id.ToString()]), question);

        Assert.Equal("Paris", result);
    }

    [Fact]
    public void Render_ProjectAnswer_UnpacksFilesInsteadOfDumpingJson()
    {
        var answer = Project(("src/App.jsx", "export default function App() {}"),
                             ("package.json", "{}"));

        var result = CandidateAnswerRenderer.Render(new CandidateAnswer(answer, []), Question());

        // The reviewer sees code, not escaped JSON.
        Assert.DoesNotContain(@"\n", result);      // no escaped newlines
        Assert.DoesNotContain("\"files\"", result);
        Assert.Contains("\n", result);              // real line breaks instead
        Assert.Contains("src/App.jsx", result);
        Assert.Contains("export default function App() {}", result);
        Assert.Contains("package.json", result);
    }

    [Fact]
    public void Render_ProjectAnswer_LeadsWithWhatTheCandidateChanged()
    {
        var starter = Project(("package.json", "{}"),
                              ("src/App.jsx", "// TODO"));
        var submitted = Project(("package.json", "{}"),
                                ("src/App.jsx", "// TODO\nconst answer = 42;"),
                                ("src/helper.js", "export const help = 1;"));

        var result = CandidateAnswerRenderer.Render(
            new CandidateAnswer(submitted, []), Question(starter));

        Assert.Contains("src/App.jsx  (entry, modified)", result);
        Assert.Contains("src/helper.js  (added)", result);
        Assert.Contains("package.json  (unchanged)", result);

        // Untouched scaffolding must not be the first thing the reviewer reads.
        Assert.True(result.IndexOf("src/App.jsx", StringComparison.Ordinal)
                    < result.IndexOf("package.json", StringComparison.Ordinal));
    }

    [Fact]
    public void Render_ProjectAnswer_IgnoresLineEndingOnlyDifferences()
    {
        var starter = Project(("src/App.jsx", "line one\nline two"));
        var submitted = Project(("src/App.jsx", "line one\r\nline two\r\n"));

        var result = CandidateAnswerRenderer.Render(
            new CandidateAnswer(submitted, []), Question(starter));

        Assert.Contains("(entry, unchanged)", result);
    }

    [Fact]
    public void Render_NonProjectJsonAnswer_IsLeftAlone()
    {
        const string json = "{\"reasoning\":\"I chose a hash map for O(1) lookups.\"}";

        var result = CandidateAnswerRenderer.Render(new CandidateAnswer(json, []), Question());

        Assert.Equal(json, result);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static Question Question(string? projectFiles = null) => new()
    {
        Title = "Q",
        Description = "d",
        Type = QuestionType.FrontendProject,
        Difficulty = Difficulty.Medium,
        GradingMethod = GradingMethod.AutoGraded,
        Points = 10,
        DurationMinutes = 30,
        ProjectFiles = projectFiles,
    };

    private static string Project(params (string Path, string Content)[] files) =>
        JsonSerializer.Serialize(new
        {
            entry = "src/App.jsx",
            files = files.Select(f => new { path = f.Path, content = f.Content }).ToArray(),
        });
}
