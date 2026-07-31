using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Grading;
using EY.HRPlatform.Interview.Features.Grading.FrontendRunner;
using EY.HRPlatform.Interview.Features.Grading.Graders;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.Interview.Tests.Features.Grading;

public class FrontendProjectGraderTests
{
    [Fact]
    public void CanGrade_FrontendProjectWithTests_IsTrue()
    {
        var grader = new FrontendProjectGrader(new StubRunner(), NullLogger<FrontendProjectGrader>.Instance);
        var question = new Question { Type = QuestionType.FrontendProject, Framework = "react", FrontendTestFiles = "{\"files\":[]}" };
        Assert.True(grader.CanGrade(question));
    }

    [Fact]
    public void CanGrade_FrontendProjectWithoutTests_IsFalse()
    {
        var grader = new FrontendProjectGrader(new StubRunner(), NullLogger<FrontendProjectGrader>.Instance);
        var question = new Question { Type = QuestionType.FrontendProject, Framework = "react", FrontendTestFiles = null };
        Assert.False(grader.CanGrade(question));
    }

    [Fact]
    public void CanGrade_NonFrontendType_IsFalse()
    {
        var grader = new FrontendProjectGrader(new StubRunner(), NullLogger<FrontendProjectGrader>.Instance);
        var question = new Question { Type = QuestionType.Coding, FrontendTestFiles = "{\"files\":[]}" };
        Assert.False(grader.CanGrade(question));
    }

    [Fact]
    public async Task GradeAsync_ScoresProportionally_ToTestsPassed()
    {
        var runner = new StubRunner { Result = new FrontendRunResult(FrontendRunStatus.Ran, 0, 4, 3, null) };
        var grader = new FrontendProjectGrader(runner, NullLogger<FrontendProjectGrader>.Instance);

        var result = await grader.GradeAsync(FrontendQuestion(points: 10), CandidateAnswer(), CancellationToken.None);

        Assert.Equal(7.5m, result.Score);           // 3/4 of 10
        Assert.Equal("FrontendProject", result.GraderType);
        Assert.False(result.NeedsHumanReview);
        Assert.Contains("3/4", result.Feedback);
    }

    [Fact]
    public async Task GradeAsync_OverlaysAuthorTests_OverCandidateFiles()
    {
        var runner = new StubRunner { Result = new FrontendRunResult(FrontendRunStatus.Ran, 0, 1, 1, null) };
        var grader = new FrontendProjectGrader(runner, NullLogger<FrontendProjectGrader>.Instance);

        // Candidate ships a fake, trivially-green test at the same path the author uses.
        var answer = new CandidateAnswer(
            "{\"files\":[{\"path\":\"src/App.jsx\",\"content\":\"CANDIDATE_APP\"}," +
            "{\"path\":\"src/App.test.jsx\",\"content\":\"FAKE_PASSING_TEST\"}]}",
            []);
        var question = FrontendQuestion(
            points: 10,
            tests: "{\"files\":[{\"path\":\"src/App.test.jsx\",\"content\":\"REAL_AUTHOR_TEST\"}]}");

        await grader.GradeAsync(question, answer, CancellationToken.None);

        var files = runner.LastRequest!.Files.ToDictionary(f => f.Path, f => f.Content);
        Assert.Equal("REAL_AUTHOR_TEST", files["src/App.test.jsx"]); // author wins — candidate can't fake tests
        Assert.Equal("CANDIDATE_APP", files["src/App.jsx"]);          // candidate source is preserved
    }

    [Fact]
    public async Task GradeAsync_NoTestsCollected_QueuesForReview_InsteadOfSilentZero()
    {
        // A suite that fails to compile/collect reports zero tests. Scoring that as 0/0 would
        // silently zero the candidate — and could hide a fault in our own runner image.
        var runner = new StubRunner { Result = new FrontendRunResult(FrontendRunStatus.Ran, 0, 0, 0, null) };
        var grader = new FrontendProjectGrader(runner, NullLogger<FrontendProjectGrader>.Instance);

        var result = await grader.GradeAsync(FrontendQuestion(points: 10), CandidateAnswer(), CancellationToken.None);

        Assert.Equal(0m, result.Score);
        Assert.True(result.NeedsHumanReview);
    }

    [Fact]
    public async Task GradeAsync_UnreadableResult_QueuesForReview()
    {
        // Runner produced no counts at all (missing/garbled report).
        var runner = new StubRunner { Result = new FrontendRunResult(FrontendRunStatus.Ran, 0, null, null, null) };
        var grader = new FrontendProjectGrader(runner, NullLogger<FrontendProjectGrader>.Instance);

        var result = await grader.GradeAsync(FrontendQuestion(points: 10), CandidateAnswer(), CancellationToken.None);

        Assert.Equal(0m, result.Score);
        Assert.True(result.NeedsHumanReview);
    }

    [Fact]
    public async Task GradeAsync_FailingTests_StillScoresAutomatically()
    {
        // Real assertion failures are NOT ambiguous — they score, no review.
        var runner = new StubRunner { Result = new FrontendRunResult(FrontendRunStatus.Ran, 1, 2, 0, null) };
        var grader = new FrontendProjectGrader(runner, NullLogger<FrontendProjectGrader>.Instance);

        var result = await grader.GradeAsync(FrontendQuestion(points: 10), CandidateAnswer(), CancellationToken.None);

        Assert.Equal(0m, result.Score);
        Assert.False(result.NeedsHumanReview);
        Assert.Contains("0/2", result.Feedback);
    }

    [Fact]
    public async Task GradeAsync_InstallFailure_QueuesForReview()
    {
        var runner = new StubRunner { Result = new FrontendRunResult(FrontendRunStatus.InstallFailed, 2, null, null, "npm ci failed") };
        var grader = new FrontendProjectGrader(runner, NullLogger<FrontendProjectGrader>.Instance);

        var result = await grader.GradeAsync(FrontendQuestion(points: 10), CandidateAnswer(), CancellationToken.None);

        Assert.Equal(0m, result.Score);
        Assert.True(result.NeedsHumanReview);
    }

    [Fact]
    public async Task GradeAsync_EmptySubmission_ScoresZeroWithoutReview()
    {
        var runner = new StubRunner();
        var grader = new FrontendProjectGrader(runner, NullLogger<FrontendProjectGrader>.Instance);

        var result = await grader.GradeAsync(FrontendQuestion(points: 10), new CandidateAnswer("", []), CancellationToken.None);

        Assert.Equal(0m, result.Score);
        Assert.False(result.NeedsHumanReview);
        Assert.Null(runner.LastRequest); // runner never invoked for an empty answer
    }

    [Fact]
    public async Task GradeAsync_RunnerThrows_QueuesForReview()
    {
        var runner = new StubRunner { Throw = new InvalidOperationException("docker missing") };
        var grader = new FrontendProjectGrader(runner, NullLogger<FrontendProjectGrader>.Instance);

        var result = await grader.GradeAsync(FrontendQuestion(points: 10), CandidateAnswer(), CancellationToken.None);

        Assert.Equal(0m, result.Score);
        Assert.True(result.NeedsHumanReview);
    }

    private static Question FrontendQuestion(int points, string? tests = null) => new()
    {
        Type = QuestionType.FrontendProject,
        Framework = "react",
        Points = points,
        FrontendTestFiles = tests ?? "{\"files\":[{\"path\":\"src/App.test.jsx\",\"content\":\"test\"}]}",
    };

    private static CandidateAnswer CandidateAnswer() =>
        new("{\"files\":[{\"path\":\"src/App.jsx\",\"content\":\"export default function App(){return null}\"}]}", []);

    private sealed class StubRunner : IFrontendProjectRunner
    {
        public FrontendRunRequest? LastRequest { get; private set; }
        public FrontendRunResult Result { get; set; } = new(FrontendRunStatus.Ran, 0, 1, 1, null);
        public Exception? Throw { get; set; }

        public Task<FrontendRunResult> RunAsync(FrontendRunRequest request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            if (Throw is not null)
                throw Throw;
            return Task.FromResult(Result);
        }
    }
}
