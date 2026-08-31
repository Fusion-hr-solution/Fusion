using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Tests.TestHelpers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.Interview.Tests.Features.Integration;

public class InterviewRoutesIntegrationTests
{
    [Fact]
    public async Task GetQuestions_ReturnsEnvelopeAndItems()
    {
        await using var factory = new InterviewApiFactory();
        await SeedQuestionAsync(factory.Services);
        var client = factory.CreateAuthenticatedClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.GetAsync("/api/interview/questions?page=1&pageSize=10");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(json.RootElement.GetProperty("success").GetBoolean());
        var items = json.RootElement.GetProperty("data").GetProperty("items");
        Assert.True(items.GetArrayLength() >= 1);
    }

    [Fact]
    public async Task PostTests_WhenStatusOmitted_DefaultsToDraft()
    {
        await using var factory = new InterviewApiFactory();
        var client = factory.CreateAuthenticatedClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var request = new
        {
            title = "Backend Screening",
            description = "Core interview test",
            discipline = "Engineering"
        };

        var response = await client.PostAsJsonAsync("/api/interview/tests", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(json.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("Draft", json.RootElement.GetProperty("data").GetProperty("status").GetString());
    }

    [Fact]
    public async Task PostTestQuestionMapping_WhenDuplicate_Returns409()
    {
        await using var factory = new InterviewApiFactory();
        var (testId, questionId) = await SeedTestWithQuestionAsync(factory.Services, withMapping: true);
        var client = factory.CreateAuthenticatedClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PostAsync($"/api/interview/tests/{testId}/questions/{questionId}", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.False(json.RootElement.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task GetTestQuestions_ReturnsMappedQuestionShape()
    {
        await using var factory = new InterviewApiFactory();
        var (testId, _) = await SeedTestWithQuestionAsync(factory.Services, withMapping: true);
        var client = factory.CreateAuthenticatedClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.GetAsync($"/api/interview/tests/{testId}/questions");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(json.RootElement.GetProperty("success").GetBoolean());

        var items = json.RootElement.GetProperty("data");
        Assert.True(items.GetArrayLength() >= 1);
        var first = items[0];
        Assert.Equal("Multiple Choice", first.GetProperty("type").GetString());
        Assert.Equal("Auto-graded", first.GetProperty("gradingMethod").GetString());
    }

    [Fact]
    public async Task PostTests_WhenDisciplineTooLong_Returns400WithFailureEnvelope()
    {
        await using var factory = new InterviewApiFactory();
        var client = factory.CreateAuthenticatedClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        // Discipline is no longer a fixed enum, so an unrecognised name is valid (see the test
        // below). What still fails is a value that would not fit the column.
        var request = new
        {
            title = "Overlong discipline test",
            description = "Desc",
            discipline = new string('x', 31)
        };

        var response = await client.PostAsJsonAsync("/api/interview/tests", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.False(json.RootElement.GetProperty("success").GetBoolean());
        Assert.Contains("Discipline cannot exceed", json.RootElement.GetProperty("message").GetString());
        Assert.True(json.RootElement.TryGetProperty("errors", out var errors));
        Assert.True(errors.ValueKind == JsonValueKind.Array);
    }

    [Fact]
    public async Task PostTests_AcceptsADisciplineOutsideTheOriginalEnum()
    {
        await using var factory = new InterviewApiFactory();
        var client = factory.CreateAuthenticatedClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        // "Legal" was rejected while Discipline was a C# enum. It is now an admin-curated label,
        // so the API stores whatever the taxonomy offers.
        var response = await client.PostAsJsonAsync("/api/interview/tests", new
        {
            title = "Paralegal screening",
            description = "Desc",
            discipline = "Legal"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Legal", json.RootElement.GetProperty("data").GetProperty("discipline").GetString());
    }

    [Fact]
    public async Task GetQuestions_WhenPaginationInvalid_Returns400WithEnvelope()
    {
        await using var factory = new InterviewApiFactory();
        var client = factory.CreateAuthenticatedClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.GetAsync("/api/interview/questions?page=0&pageSize=10");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.False(json.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("Invalid pagination values.", json.RootElement.GetProperty("message").GetString());
        Assert.True(json.RootElement.TryGetProperty("errors", out var errors));
        Assert.True(errors.ValueKind == JsonValueKind.Array);
    }

    [Fact]
    public async Task GetTests_WhenQuestionTypeInvalid_Returns400WithFailureEnvelope()
    {
        await using var factory = new InterviewApiFactory();
        var client = factory.CreateAuthenticatedClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.GetAsync("/api/interview/tests?questionType=BadType");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.False(json.RootElement.GetProperty("success").GetBoolean());
        Assert.Contains("Invalid QuestionType", json.RootElement.GetProperty("message").GetString());
        Assert.True(json.RootElement.TryGetProperty("errors", out var errors));
        Assert.True(errors.ValueKind == JsonValueKind.Array);
    }

    private static async Task SeedQuestionAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        db.Questions.Add(new Question
        {
            Title = "SQL basics",
            Description = "Simple select",
            Type = QuestionType.Sql,
            Difficulty = "Easy",
            GradingMethod = GradingMethod.Manual,
            Points = 5,
            DurationMinutes = 5,
            UsageCount = 0,
            Language = "SQL"
        });

        await db.SaveChangesAsync();
    }

    private static async Task<(Guid testId, Guid questionId)> SeedTestWithQuestionAsync(IServiceProvider services, bool withMapping)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var test = new Test
        {
            Title = "Backend Test",
            Description = "Desc",
            Discipline = "Engineering",
            Status = TestStatus.Draft,
            CandidateCount = 0
        };

        var question = new Question
        {
            Title = "MCQ",
            Description = "Desc",
            Type = QuestionType.MultipleChoice,
            Difficulty = "Easy",
            GradingMethod = GradingMethod.AutoGraded,
            Points = 10,
            DurationMinutes = 5,
            UsageCount = 0,
            Options =
            [
                new QuestionOption { Text = "A", Correct = true },
                new QuestionOption { Text = "B", Correct = false }
            ]
        };

        db.Tests.Add(test);
        db.Questions.Add(question);
        await db.SaveChangesAsync();

        if (withMapping)
        {
            db.TestQuestions.Add(new TestQuestion
            {
                TestId = test.Id,
                QuestionId = question.Id
            });
            await db.SaveChangesAsync();
        }

        return (test.Id, question.Id);
    }
}