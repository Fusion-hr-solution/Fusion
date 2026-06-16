using System.Net;
using System.Text;
using System.Text.Json;
using EY.HRPlatform.Interview.Features.Grading.Groq;
using EY.HRPlatform.Interview.Features.Questions;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Questions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.Interview.Tests.Features.Questions;

public class QuestionGeneratorServiceTests
{
    // ── Error paths ─────────────────────────────────────────────────────────

    [Fact]
    public async Task GenerateAsync_WhenTopicMissing_Throws400()
    {
        var service = ServiceWith(GroqReturning("[]"));

        var ex = await Assert.ThrowsAsync<ApiException>(
            () => service.GenerateAsync(new GenerateQuestionsRequestDto { Topic = "  " }, CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, ex.StatusCode);
    }

    [Fact]
    public async Task GenerateAsync_WhenGroqNotConfigured_Throws503()
    {
        var service = ServiceWith(null); // GroqClient not registered

        var ex = await Assert.ThrowsAsync<ApiException>(
            () => service.GenerateAsync(Request("React hooks"), CancellationToken.None));

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, ex.StatusCode);
    }

    [Fact]
    public async Task GenerateAsync_WhenModelReturnsEmptyArray_Throws422()
    {
        var service = ServiceWith(GroqReturning("[]"));

        var ex = await Assert.ThrowsAsync<ApiException>(
            () => service.GenerateAsync(Request("React hooks"), CancellationToken.None));

        Assert.Equal(StatusCodes.Status422UnprocessableEntity, ex.StatusCode);
    }

    [Fact]
    public async Task GenerateAsync_WhenModelReturnsNonJson_Throws422()
    {
        var service = ServiceWith(GroqReturning("Sorry, I can't help with that."));

        var ex = await Assert.ThrowsAsync<ApiException>(
            () => service.GenerateAsync(Request("React hooks"), CancellationToken.None));

        Assert.Equal(StatusCodes.Status422UnprocessableEntity, ex.StatusCode);
    }

    // ── Parsing / tolerance ─────────────────────────────────────────────────

    [Fact]
    public async Task GenerateAsync_MapsValidDrafts()
    {
        const string content = """
        [
          {"type":"Multiple Choice","title":"Q1","description":"What is 2+2?","difficulty":"Easy","gradingMethod":"Auto-graded","points":5,"durationMinutes":3,"tags":["math"],"options":[{"text":"4","correct":true},{"text":"3","correct":false}],"language":"","starterCode":"","evaluationCriteria":""},
          {"type":"Coding","title":"Reverse","description":"Reverse a string","difficulty":"Medium","gradingMethod":"Auto-graded","points":20,"durationMinutes":15,"tags":["strings"],"options":[],"language":"Python","starterCode":"def f():","evaluationCriteria":""}
        ]
        """;
        var service = ServiceWith(GroqReturning(content));

        var drafts = await service.GenerateAsync(Request("basics"), CancellationToken.None);

        Assert.Equal(2, drafts.Count);
        Assert.Equal("Multiple Choice", drafts[0].Type);
        Assert.Single(drafts[0].Options, o => o.Correct);
        Assert.Equal("Coding", drafts[1].Type);
        Assert.Equal("Python", drafts[1].Language);
    }

    [Fact]
    public async Task GenerateAsync_ParsesJsonWrappedInMarkdownAndProse()
    {
        const string content = """
        Here are your questions:
        ```json
        [{"type":"Essay","title":"Explain REST","description":"Explain REST.","difficulty":"Medium","gradingMethod":"Manual","points":10,"durationMinutes":10,"tags":[],"options":[],"language":"","starterCode":"","evaluationCriteria":"Clarity"}]
        ```
        Hope that helps!
        """;
        var service = ServiceWith(GroqReturning(content));

        var drafts = await service.GenerateAsync(Request("rest"), CancellationToken.None);

        Assert.Single(drafts);
        Assert.Equal("Essay", drafts[0].Type);
    }

    // ── Normalization ───────────────────────────────────────────────────────

    [Fact]
    public async Task GenerateAsync_NormalizesInvalidEnumsToDefaults()
    {
        const string content = """
        [{"type":"Quiz","title":"Q","description":"D","difficulty":"Insane","gradingMethod":"Robot","points":10,"durationMinutes":10,"tags":[],"options":[],"language":"","starterCode":"","evaluationCriteria":""}]
        """;
        var service = ServiceWith(GroqReturning(content));

        var drafts = await service.GenerateAsync(Request("anything"), CancellationToken.None);

        var draft = Assert.Single(drafts);
        Assert.Equal("Multiple Choice", draft.Type);     // unknown type → default
        Assert.Equal("Medium", draft.Difficulty);        // unknown difficulty → default
        Assert.Equal("Auto-graded", draft.GradingMethod); // default grading for MCQ
    }

    [Fact]
    public async Task GenerateAsync_ClampsPointsAndDuration()
    {
        const string content = """
        [{"type":"Essay","title":"Q","description":"D","difficulty":"Hard","gradingMethod":"Manual","points":999,"durationMinutes":999,"tags":[],"options":[],"language":"","starterCode":"","evaluationCriteria":"x"}]
        """;
        var service = ServiceWith(GroqReturning(content));

        var draft = Assert.Single(await service.GenerateAsync(Request("anything"), CancellationToken.None));

        Assert.Equal(100, draft.Points);
        Assert.Equal(120, draft.DurationMinutes);
    }

    [Fact]
    public async Task GenerateAsync_DerivesTitleFromDescription_WhenTitleMissing()
    {
        const string content = """
        [{"type":"Essay","title":"","description":"Explain the difference between var and let in JavaScript.","difficulty":"Medium","gradingMethod":"Manual","points":10,"durationMinutes":10,"tags":[],"options":[],"language":"","starterCode":"","evaluationCriteria":"x"}]
        """;
        var service = ServiceWith(GroqReturning(content));

        var draft = Assert.Single(await service.GenerateAsync(Request("js"), CancellationToken.None));

        Assert.False(string.IsNullOrWhiteSpace(draft.Title));
        Assert.StartsWith("Explain the difference", draft.Title);
    }

    [Fact]
    public async Task GenerateAsync_MarksFirstOptionCorrect_WhenMcqHasNoCorrectAnswer()
    {
        const string content = """
        [{"type":"Multiple Choice","title":"Q","description":"D","difficulty":"Easy","gradingMethod":"Auto-graded","points":5,"durationMinutes":2,"tags":[],"options":[{"text":"A","correct":false},{"text":"B","correct":false}],"language":"","starterCode":"","evaluationCriteria":""}]
        """;
        var service = ServiceWith(GroqReturning(content));

        var draft = Assert.Single(await service.GenerateAsync(Request("anything"), CancellationToken.None));

        Assert.Equal(2, draft.Options.Count);
        Assert.True(draft.Options[0].Correct);
        Assert.False(draft.Options[1].Correct);
    }

    [Fact]
    public async Task GenerateAsync_RespectsForcedType_OverModelType()
    {
        const string content = """
        [{"type":"Coding","title":"Q","description":"D","difficulty":"Medium","gradingMethod":"Auto-graded","points":10,"durationMinutes":10,"tags":[],"options":[],"language":"Python","starterCode":"","evaluationCriteria":""}]
        """;
        var service = ServiceWith(GroqReturning(content));

        var request = Request("anything");
        request.Type = "Essay";

        var draft = Assert.Single(await service.GenerateAsync(request, CancellationToken.None));

        Assert.Equal("Essay", draft.Type);
    }

    [Fact]
    public async Task GenerateAsync_WithOutOfRangeCount_StillReturnsDrafts()
    {
        const string content = """
        [{"type":"Essay","title":"Q","description":"D","difficulty":"Easy","gradingMethod":"Manual","points":10,"durationMinutes":10,"tags":[],"options":[],"language":"","starterCode":"","evaluationCriteria":"x"}]
        """;
        var service = ServiceWith(GroqReturning(content));

        var request = Request("anything");
        request.Count = 999; // clamped internally; must not throw

        var drafts = await service.GenerateAsync(request, CancellationToken.None);

        Assert.Single(drafts);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static GenerateQuestionsRequestDto Request(string topic) => new() { Topic = topic };

    private static QuestionGeneratorService ServiceWith(GroqClient? groq)
    {
        var services = new ServiceCollection();
        if (groq is not null)
            services.AddSingleton(groq);
        var provider = services.BuildServiceProvider();
        return new QuestionGeneratorService(provider, NullLogger<QuestionGeneratorService>.Instance);
    }

    /// <summary>Builds a GroqClient whose HTTP layer returns a canned chat-completion
    /// whose message content is <paramref name="content"/> (the model's raw output).</summary>
    private static GroqClient GroqReturning(string content)
    {
        var groqResponse = JsonSerializer.Serialize(new
        {
            choices = new[] { new { message = new { content } } }
        });

        var handler = new StubHandler(() => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(groqResponse, Encoding.UTF8, "application/json"),
        });

        var http = new HttpClient(handler) { BaseAddress = new Uri("https://stub.groq.local") };
        return new GroqClient(http);
    }

    private sealed class StubHandler(Func<HttpResponseMessage> responder) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(responder());
    }
}
