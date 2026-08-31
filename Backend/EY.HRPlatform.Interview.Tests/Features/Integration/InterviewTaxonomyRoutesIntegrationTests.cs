using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Interview.Domain;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Tests.TestHelpers;
using Microsoft.AspNetCore.Mvc.Testing;

namespace EY.HRPlatform.Interview.Tests.Features.Integration;

public class InterviewTaxonomyRoutesIntegrationTests
{
    private const string Route = "/api/interview/taxonomy";

    [Fact]
    public async Task Get_WithoutAuthentication_IsRejected()
    {
        await using var factory = new InterviewApiFactory();
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
        });

        var response = await client.GetAsync(Route);

        // Proves the app-wide FallbackPolicy covers the new controller — no [Authorize] needed,
        // but also no accidental [AllowAnonymous].
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Get_ReturnsEveryListWithDefaults()
    {
        await using var factory = new InterviewApiFactory();
        var client = Authenticated(factory);

        var lists = await GetListsAsync(client);

        Assert.Equal(
            Enum.GetValues<QuestionType>().Length,
            lists.GetProperty(InterviewTaxonomy.QuestionTypes).GetProperty("items").GetArrayLength());
        Assert.True(lists.GetProperty(InterviewTaxonomy.QuestionTypes).GetProperty("locked").GetBoolean());
        Assert.False(lists.GetProperty(InterviewTaxonomy.CodingLanguages).GetProperty("locked").GetBoolean());
    }

    [Fact]
    public async Task Put_RelabellingALockedList_DoesNotChangeWhatTheWriteContractAccepts()
    {
        await using var factory = new InterviewApiFactory();
        var client = Authenticated(factory);

        // Rename the "Coding" question type to "Programming".
        var items = InterviewTaxonomy.DefaultsFor(InterviewTaxonomy.QuestionTypes)
            .Select(d => new { value = d.Value, label = d.Value == "Coding" ? "Programming" : d.Label, hidden = false })
            .ToArray();

        var save = await client.PutAsJsonAsync(Route, new
        {
            lists = new Dictionary<string, object> { [InterviewTaxonomy.QuestionTypes] = items },
        });
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);

        var lists = await GetListsAsync(client);
        var coding = lists.GetProperty(InterviewTaxonomy.QuestionTypes).GetProperty("items")
            .EnumerateArray().Single(i => i.GetProperty("value").GetString() == "Coding");
        Assert.Equal("Programming", coding.GetProperty("label").GetString());

        // The load-bearing assertion: the ORIGINAL wire value must still be accepted for writes.
        // If an admin label ever leaked into the contract, this is where it would surface.
        var created = await client.PostAsJsonAsync("/api/interview/questions", new
        {
            type = "Coding",
            title = "Reverse a string",
            description = "Reverse the given string.",
            difficulty = "Easy",
            gradingMethod = "Manual",
            points = 10,
            durationMinutes = 15,
            language = "Python",
            tags = Array.Empty<string>(),
            options = Array.Empty<object>(),
        });

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        using var body = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        Assert.Equal("Coding", body.RootElement.GetProperty("data").GetProperty("type").GetString());
    }

    [Fact]
    public async Task Put_AddingAValueToALockedList_IsRejected()
    {
        await using var factory = new InterviewApiFactory();
        var client = Authenticated(factory);

        var items = InterviewTaxonomy.DefaultsFor(InterviewTaxonomy.QuestionTypes)
            .Select(d => new { value = d.Value, label = d.Label, hidden = false })
            .Append(new { value = "Pair Programming", label = "Pair Programming", hidden = false })
            .ToArray();

        var response = await client.PutAsJsonAsync(Route, new
        {
            lists = new Dictionary<string, object> { [InterviewTaxonomy.QuestionTypes] = items },
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Put_EditingAnOpenList_PersistsAcrossRequests()
    {
        await using var factory = new InterviewApiFactory();
        var client = Authenticated(factory);

        var response = await client.PutAsJsonAsync(Route, new
        {
            lists = new Dictionary<string, object>
            {
                [InterviewTaxonomy.CodingLanguages] = new[]
                {
                    new { value = "Python", label = "Python", hidden = false },
                    new { value = "Kotlin", label = "Kotlin", hidden = false },
                },
            },
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var items = (await GetListsAsync(client))
            .GetProperty(InterviewTaxonomy.CodingLanguages).GetProperty("items")
            .EnumerateArray().ToList();

        Assert.Equal(2, items.Count);
        Assert.Contains(items, i => i.GetProperty("value").GetString() == "Kotlin");
        // Deleting a seeded language sticks — the seed must not resurrect it on read.
        Assert.DoesNotContain(items, i => i.GetProperty("value").GetString() == "Java");
    }

    [Fact]
    public async Task Get_FlagsCodingLanguagesTheGraderCannotRun()
    {
        await using var factory = new InterviewApiFactory();
        var client = Authenticated(factory);

        var items = (await GetListsAsync(client))
            .GetProperty(InterviewTaxonomy.CodingLanguages).GetProperty("items")
            .EnumerateArray().ToList();

        bool Supports(string value) => items
            .Single(i => i.GetProperty("value").GetString() == value)
            .GetProperty("supportsAutoGrading").GetBoolean();

        Assert.False(Supports("Go"));
        Assert.False(Supports("Rust"));
        Assert.True(Supports("Python"));
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static HttpClient Authenticated(InterviewApiFactory factory) =>
        factory.CreateAuthenticatedClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
        });

    private static async Task<JsonElement> GetListsAsync(HttpClient client)
    {
        var response = await client.GetAsync(Route);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return json.RootElement.GetProperty("data").GetProperty("lists").Clone();
    }
}
