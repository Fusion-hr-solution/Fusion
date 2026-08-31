using EY.HRPlatform.Interview.Domain;
using EY.HRPlatform.Interview.Features.Taxonomy;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Taxonomy;
using EY.HRPlatform.Interview.Tests.TestHelpers;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Tests.Features.Taxonomy;

public class InterviewTaxonomyServiceTests
{
    [Fact]
    public async Task GetAsync_WithNoRow_ReturnsDefaultsWithoutWriting()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new InterviewTaxonomyService(db);

        var result = await service.GetAsync(CancellationToken.None);

        Assert.Equal(0, result.Version);
        Assert.NotEmpty(result.Lists[InterviewTaxonomy.CodingLanguages].Items);
        // Reading must not create the singleton — an untouched taxonomy needs no row.
        Assert.Equal(0, await db.InterviewTaxonomySettings.CountAsync());
    }

    [Fact]
    public async Task SaveAsync_PersistsToASingleRowAndIncrementsVersion()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new InterviewTaxonomyService(db);

        var first = await service.SaveAsync(Request(InterviewTaxonomy.CodingLanguages, ("Python", "Python", false)), CancellationToken.None);
        var second = await service.SaveAsync(Request(InterviewTaxonomy.CodingLanguages, ("Python", "Python 3", false)), CancellationToken.None);

        Assert.Equal(1, first.Version);
        Assert.Equal(2, second.Version);
        Assert.Equal(1, await db.InterviewTaxonomySettings.CountAsync());
        Assert.Equal("Python 3", second.Lists[InterviewTaxonomy.CodingLanguages].Items.Single().Label);
    }

    [Fact]
    public async Task SaveAsync_IsPartial_AndLeavesOtherListsAlone()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new InterviewTaxonomyService(db);

        await service.SaveAsync(Request(InterviewTaxonomy.CodingLanguages, ("Rust", "Rust", false)), CancellationToken.None);

        // Editing a different section must not discard the first one — this is why the plan could
        // drop optimistic locking: concurrent admins only collide within one list.
        var result = await service.SaveAsync(
            Request(InterviewTaxonomy.QuestionTags, ("algorithms", "Algorithms", false)),
            CancellationToken.None);

        Assert.Equal("Rust", result.Lists[InterviewTaxonomy.CodingLanguages].Items.Single().Value);
        Assert.Equal("algorithms", result.Lists[InterviewTaxonomy.QuestionTags].Items.Single().Value);
    }

    [Fact]
    public async Task SaveAsync_LockedList_RejectsAnAddedValue()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new InterviewTaxonomyService(db);

        var request = LockedGradingMethodsRequest();
        request.Lists[InterviewTaxonomy.GradingMethods].Add(new UpdateTaxonomyItemDto
        {
            Value = "Legendary",
            Label = "Legendary",
        });

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.SaveAsync(request, CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, ex.StatusCode);
        Assert.Contains("Invalid value", ex.Message);
    }

    [Fact]
    public async Task SaveAsync_LockedList_RejectsARemovedValue()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new InterviewTaxonomyService(db);

        var request = LockedGradingMethodsRequest();
        request.Lists[InterviewTaxonomy.GradingMethods].RemoveAt(0);

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.SaveAsync(request, CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, ex.StatusCode);
        Assert.Contains("cannot be added to or removed from", ex.Message);
    }

    [Fact]
    public async Task SaveAsync_LockedList_AllowsRelabelReorderAndHide()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new InterviewTaxonomyService(db);

        var request = LockedGradingMethodsRequest();
        request.Lists[InterviewTaxonomy.GradingMethods][0].Label = "Scored automatically";
        request.Lists[InterviewTaxonomy.GradingMethods][^1].Hidden = true;
        request.Lists[InterviewTaxonomy.GradingMethods].Reverse();

        var result = await service.SaveAsync(request, CancellationToken.None);
        var items = result.Lists[InterviewTaxonomy.GradingMethods].Items;

        Assert.Equal("Scored automatically", items.Single(i => i.Value == "Auto-graded").Label);
        Assert.Equal("Manual", items[0].Value);
    }

    [Theory]
    [InlineData("nonsense", "Unknown taxonomy list")]
    public async Task SaveAsync_RejectsAnUnknownListKey(string key, string expected)
    {
        await using var db = TestDbContextFactory.Create();
        var service = new InterviewTaxonomyService(db);

        var ex = await Assert.ThrowsAsync<ApiException>(
            () => service.SaveAsync(Request(key, ("x", "x", false)), CancellationToken.None));

        Assert.Contains(expected, ex.Message);
    }

    [Fact]
    public async Task SaveAsync_RejectsDuplicateValues()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new InterviewTaxonomyService(db);

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.SaveAsync(
            Request(InterviewTaxonomy.CodingLanguages, ("Python", "Python", false), ("python", "Python again", false)),
            CancellationToken.None));

        Assert.Contains("Duplicate value", ex.Message);
    }

    [Fact]
    public async Task SaveAsync_RejectsAFullyHiddenList()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new InterviewTaxonomyService(db);

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.SaveAsync(
            Request(InterviewTaxonomy.CodingLanguages, ("Python", "Python", true)),
            CancellationToken.None));

        Assert.Contains("must remain visible", ex.Message);
    }

    [Fact]
    public async Task SaveAsync_RejectsAnEmptyLabel()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new InterviewTaxonomyService(db);

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.SaveAsync(
            Request(InterviewTaxonomy.CodingLanguages, ("Python", "   ", false)),
            CancellationToken.None));

        Assert.Contains("A label is required", ex.Message);
    }

    [Fact]
    public async Task SaveAsync_RejectsAValueTooLongForTheQuestionLanguageColumn()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new InterviewTaxonomyService(db);

        // Question.Language is varchar(80); a longer value would 500 on the next question insert.
        var ex = await Assert.ThrowsAsync<ApiException>(() => service.SaveAsync(
            Request(InterviewTaxonomy.CodingLanguages, (new string('x', 81), "Long", false)),
            CancellationToken.None));

        Assert.Contains("exceeds 80 characters", ex.Message);
    }

    [Fact]
    public async Task SaveAsync_TrimsValuesAndLabels()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new InterviewTaxonomyService(db);

        var result = await service.SaveAsync(
            Request(InterviewTaxonomy.CodingLanguages, ("  Kotlin  ", "  Kotlin  ", false)),
            CancellationToken.None);

        var item = result.Lists[InterviewTaxonomy.CodingLanguages].Items.Single();
        Assert.Equal("Kotlin", item.Value);
        Assert.Equal("Kotlin", item.Label);
    }

    [Fact]
    public async Task SaveAsync_NewlyOpenedLists_AcceptAddedAndRemovedValues()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new InterviewTaxonomyService(db);

        // Difficulty and discipline were C# enums and could not be extended. They carry no
        // behaviour — only categorisation — so they are now plain strings and fully editable.
        var result = await service.SaveAsync(new UpdateInterviewTaxonomyDto
        {
            Lists = new Dictionary<string, List<UpdateTaxonomyItemDto>>
            {
                [InterviewTaxonomy.Difficulties] =
                [
                    new() { Value = "Easy", Label = "Easy" },
                    new() { Value = "Trivial", Label = "Trivial" },
                ],
                [InterviewTaxonomy.Disciplines] =
                [
                    new() { Value = "Engineering", Label = "Engineering" },
                    new() { Value = "Legal", Label = "Legal" },
                ],
            },
        }, CancellationToken.None);

        Assert.Contains(result.Lists[InterviewTaxonomy.Difficulties].Items, i => i.Value == "Trivial");
        Assert.Contains(result.Lists[InterviewTaxonomy.Disciplines].Items, i => i.Value == "Legal");
        // Removals stick — the seed must not resurrect them.
        Assert.DoesNotContain(result.Lists[InterviewTaxonomy.Difficulties].Items, i => i.Value == "Expert");
        Assert.False(result.Lists[InterviewTaxonomy.Difficulties].Locked);
        Assert.False(result.Lists[InterviewTaxonomy.Disciplines].Locked);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static UpdateInterviewTaxonomyDto Request(string key, params (string Value, string Label, bool Hidden)[] items) =>
        new()
        {
            Lists = new Dictionary<string, List<UpdateTaxonomyItemDto>>
            {
                [key] = [.. items.Select(i => new UpdateTaxonomyItemDto { Value = i.Value, Label = i.Label, Hidden = i.Hidden })],
            },
        };

    /// <summary>A well-formed locked-list payload: every canonical value, unchanged.</summary>
    private static UpdateInterviewTaxonomyDto LockedGradingMethodsRequest() =>
        new()
        {
            Lists = new Dictionary<string, List<UpdateTaxonomyItemDto>>
            {
                [InterviewTaxonomy.GradingMethods] =
                [
                    .. InterviewTaxonomy.DefaultsFor(InterviewTaxonomy.GradingMethods)
                        .Select(d => new UpdateTaxonomyItemDto { Value = d.Value, Label = d.Label }),
                ],
            },
        };
}
