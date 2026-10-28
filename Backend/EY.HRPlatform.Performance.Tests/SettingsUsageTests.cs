using System.Net.Http.Json;
using System.Text.Json;
using static EY.HRPlatform.Performance.Tests.TestHelpers.ReviewWorld;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>Settings show where things are used (B-108): scale versions by round, a competency's cycles, a question's rounds.</summary>
public sealed class SettingsUsageTests
{
    [Fact]
    public async Task A_launched_round_is_named_on_the_scale_version_competency_and_questions_it_used()
    {
        await using var world = await CreateAsync();
        var competency = (await Data(await world.Admin.PostAsJsonAsync("/api/performance/settings/competencies",
            new { name = "Ownership", description = "Sees work through.", behaviors = Array.Empty<string>() }))).GetProperty("id").GetGuid();
        var round = await world.CreateRoundAsync(competencyIds: [competency]);
        var asked = round.GetProperty("questions").EnumerateArray().Select(q => q.GetProperty("questionId").GetGuid()).ToHashSet();

        // A Draft has used nothing yet.
        Assert.Empty(Assert.Single((await Data(await world.Admin.GetAsync("/api/performance/settings/rating-scale")))
            .GetProperty("versions").EnumerateArray()).GetProperty("usedBy").EnumerateArray());
        Assert.Empty((await CompetencyAsync(world, competency)).GetProperty("usedIn").EnumerateArray());

        await world.LaunchAsync(round);

        var scale = await Data(await world.Admin.GetAsync("/api/performance/settings/rating-scale"));
        var first = Assert.Single(scale.GetProperty("versions").EnumerateArray());
        Assert.Equal(1, first.GetProperty("number").GetInt32());
        Assert.Equal(["FY2027 · Year-end review"], first.GetProperty("usedBy").EnumerateArray().Select(r => r.GetString()));
        Assert.Equal(["FY2027"], (await CompetencyAsync(world, competency)).GetProperty("usedIn").EnumerateArray().Select(c => c.GetString()));

        var questions = (await Data(await world.Admin.GetAsync("/api/performance/settings/review-questions"))).EnumerateArray().ToList();
        Assert.All(questions, q => Assert.Equal(asked.Contains(q.GetProperty("id").GetGuid()) ? 1 : 0, q.GetProperty("roundCount").GetInt32()));

        // A new version starts unused, newest first; the old one keeps its round.
        var levels = scale.GetProperty("levels").EnumerateArray()
            .Select(level => new { value = level.GetProperty("value").GetInt32(), label = level.GetProperty("label").GetString() + "!", description = (string?)null })
            .ToArray();
        var saved = await Data(await world.Admin.PutAsJsonAsync("/api/performance/settings/rating-scale",
            new { levels, expectedVersion = scale.GetProperty("version").GetUInt32() }));
        var versions = saved.GetProperty("versions").EnumerateArray().ToList();
        Assert.Equal([2, 1], versions.Select(v => v.GetProperty("number").GetInt32()));
        Assert.Empty(versions[0].GetProperty("usedBy").EnumerateArray());
        Assert.Single(versions[1].GetProperty("usedBy").EnumerateArray());
    }

    private static async Task<JsonElement> CompetencyAsync(TestHelpers.ReviewWorld world, Guid id)
        => (await Data(await world.Admin.GetAsync("/api/performance/settings/competencies"))).EnumerateArray()
            .Single(item => item.GetProperty("id").GetGuid() == id);
}
