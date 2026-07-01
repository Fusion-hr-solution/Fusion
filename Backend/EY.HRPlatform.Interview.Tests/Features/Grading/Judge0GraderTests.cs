using System.Net;
using System.Text;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Grading;
using EY.HRPlatform.Interview.Features.Grading.Graders;
using EY.HRPlatform.Interview.Features.Grading.Judge0;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.Interview.Tests.Features.Grading;

public class Judge0GraderTests
{
    [Fact]
    public async Task GradeAsync_MultiFileQuestion_PackagesAdditionalFiles_AndScores()
    {
        var handler = new StubJudge0Handler();
        var grader = new Judge0Grader(Judge0Client(handler), NullLogger<Judge0Grader>.Instance);

        var question = new Question
        {
            Type = QuestionType.Coding,
            Points = 10,
            Language = "python",
            ProjectFiles = "{\"entry\":\"main.py\",\"files\":[{\"path\":\"main.py\",\"content\":\"x\"}]}",
            // Stub program prints "ok\n"; expected "ok" (no newline) must still pass — trailing-newline tolerance.
            TestCases = "[{\"input\":\"1\",\"expectedOutput\":\"ok\"},{\"input\":\"2\",\"expectedOutput\":\"ok\"}]",
        };
        var answer = new CandidateAnswer(
            "{\"entry\":\"main.py\",\"files\":[{\"path\":\"main.py\",\"content\":\"import util\\nprint(util.x)\"},{\"path\":\"util.py\",\"content\":\"x = 1\"}]}",
            []);

        var result = await grader.GradeAsync(question, answer, CancellationToken.None);

        Assert.Equal(10m, result.Score);                 // all (2/2) test cases accepted
        Assert.Equal(2, handler.PostBodies.Count);        // one submission per test case
        Assert.All(handler.PostBodies, body => Assert.Contains("additional_files", body));
    }

    [Fact]
    public async Task GradeAsync_SingleFileQuestion_DoesNotSendAdditionalFiles()
    {
        var handler = new StubJudge0Handler();
        var grader = new Judge0Grader(Judge0Client(handler), NullLogger<Judge0Grader>.Instance);

        var question = new Question
        {
            Type = QuestionType.Coding,
            Points = 10,
            Language = "python",
            ProjectFiles = null, // single-file
            TestCases = "[{\"input\":\"1\",\"expectedOutput\":\"ok\"}]",
        };
        var answer = new CandidateAnswer("print(1)", []);

        var result = await grader.GradeAsync(question, answer, CancellationToken.None);

        Assert.Equal(10m, result.Score);
        Assert.Single(handler.PostBodies);
        Assert.DoesNotContain("additional_files", handler.PostBodies[0]);
    }

    private static Judge0Client Judge0Client(StubJudge0Handler handler) =>
        new(new HttpClient(handler) { BaseAddress = new Uri("https://stub.judge0.local") });

    /// <summary>POST /submissions returns a token (and records the request body); the GET poll
    /// returns an "Accepted" result so every test case passes.</summary>
    private sealed class StubJudge0Handler : HttpMessageHandler
    {
        public List<string> PostBodies { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (request.Method == HttpMethod.Post)
            {
                PostBodies.Add(await request.Content!.ReadAsStringAsync(cancellationToken));
                return Json($"{{\"token\":\"{Guid.NewGuid():N}\"}}");
            }

            // Poll: status.id 3 = ran cleanly; stdout is base64("ok\n").
            return Json("{\"status\":{\"id\":3,\"description\":\"Accepted\"},\"stdout\":\"b2sK\",\"stderr\":null,\"compile_output\":null,\"time\":\"0.01\",\"memory\":1000}");
        }

        private static HttpResponseMessage Json(string content) =>
            new(HttpStatusCode.OK) { Content = new StringContent(content, Encoding.UTF8, "application/json") };
    }
}
