using System.Text.Json;
using EY.HRPlatform.Interview.Domain;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Taxonomy;
using EY.HRPlatform.Interview.Models.Taxonomy;

namespace EY.HRPlatform.Interview.Tests.Features.Taxonomy;

/// <summary>
/// The merger is where "an admin can never break the API contract" is actually enforced, so these
/// cover the locked/open asymmetry rather than just the happy path.
/// </summary>
public class InterviewTaxonomyMergerTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("{}")]
    [InlineData("not json at all")]
    [InlineData("{\"questionTypes\": \"this should be an array\"}")]
    public void Merge_WithNoUsableOverrides_ReturnsDefaults(string? overridesJson)
    {
        var result = InterviewTaxonomyMerger.Merge(overridesJson, version: 0);

        // A corrupt blob must degrade to a working system, never a 500.
        Assert.Equal(
            Enum.GetValues<QuestionType>().Length,
            result.Lists[InterviewTaxonomy.QuestionTypes].Items.Count);
        Assert.All(result.Lists.Values, list => Assert.NotEmpty(
            list.Key == InterviewTaxonomy.QuestionTags ? [new TaxonomyItemDto()] : list.Items));
    }

    [Fact]
    public void Merge_LockedList_ReAppendsACanonicalValueTheOverrideOmitted()
    {
        // Simulates a blob saved before a new enum member existed.
        var json = Overrides(InterviewTaxonomy.GradingMethods, [("Auto-graded", "Auto-graded", false)]);

        var items = InterviewTaxonomyMerger.Merge(json, 1).Lists[InterviewTaxonomy.GradingMethods].Items;

        Assert.Equal(Enum.GetNames<GradingMethod>().Length, items.Count);
        Assert.False(items.Single(i => i.Value == "Manual").Hidden);
    }

    [Fact]
    public void Merge_LockedList_DropsAValueThatIsNotCanonical()
    {
        // Simulates a stale blob after an enum member was removed.
        var json = Overrides(InterviewTaxonomy.GradingMethods,
            [("Manual", "Manual", false), ("Telepathy", "Telepathy", false)]);

        var items = InterviewTaxonomyMerger.Merge(json, 1).Lists[InterviewTaxonomy.GradingMethods].Items;

        Assert.DoesNotContain(items, i => i.Value == "Telepathy");
        Assert.Equal(Enum.GetNames<GradingMethod>().Length, items.Count);
    }

    [Fact]
    public void Merge_LockedList_RoundTripsRelabelAndReorderWithoutChangingValues()
    {
        var json = Overrides(InterviewTaxonomy.GradingMethods,
        [
            ("Manual", "Manual", false),
            ("Auto-graded", "Scored automatically", false),
            ("Hybrid", "Hybrid", true),
        ]);

        var items = InterviewTaxonomyMerger.Merge(json, 1).Lists[InterviewTaxonomy.GradingMethods].Items;

        Assert.Equal("Manual", items[0].Value);                    // order honoured
        Assert.Equal("Scored automatically", items[1].Label);      // relabelled
        Assert.Equal("Auto-graded", items[1].Value);               // value untouched — the whole point
        Assert.False(items[1].IsDefault);                          // flagged as customised
        Assert.True(items.Single(i => i.Value == "Hybrid").Hidden);
    }

    [Fact]
    public void Merge_OpenList_KeepsADeletedValueDeleted()
    {
        // The seed must not resurrect a language the admin removed.
        var json = Overrides(InterviewTaxonomy.CodingLanguages,
            [("Python", "Python", false), ("SQL", "SQL", false)]);

        var items = InterviewTaxonomyMerger.Merge(json, 1).Lists[InterviewTaxonomy.CodingLanguages].Items;

        Assert.Equal(2, items.Count);
        Assert.DoesNotContain(items, i => i.Value == "Java");
    }

    [Fact]
    public void Merge_OpenList_AcceptsAValueThatIsNotInTheSeed()
    {
        var json = Overrides(InterviewTaxonomy.CodingLanguages, [("Kotlin", "Kotlin", false)]);

        var items = InterviewTaxonomyMerger.Merge(json, 1).Lists[InterviewTaxonomy.CodingLanguages].Items;

        Assert.Equal("Kotlin", Assert.Single(items).Value);
    }

    [Fact]
    public void Merge_CodingLanguages_FlagsTheOnesTheGraderCannotActuallyRun()
    {
        var items = InterviewTaxonomyMerger.Merge(null, 0).Lists[InterviewTaxonomy.CodingLanguages].Items;

        // Go, Rust and Bash ship in the dropdown but have no Judge0 mapping, so submissions are
        // silently executed as Python 3. The UI badges these; this pins the detection.
        Assert.False(items.Single(i => i.Value == "Go").SupportsAutoGrading);
        Assert.False(items.Single(i => i.Value == "Rust").SupportsAutoGrading);
        Assert.False(items.Single(i => i.Value == "Bash").SupportsAutoGrading);
        Assert.True(items.Single(i => i.Value == "Python").SupportsAutoGrading);
        Assert.True(items.Single(i => i.Value == "SQL").SupportsAutoGrading);
    }

    [Fact]
    public void Merge_OnlySetsSupportsAutoGrading_ForCodingLanguages()
    {
        var result = InterviewTaxonomyMerger.Merge(null, 0);

        Assert.All(result.Lists[InterviewTaxonomy.QuestionTypes].Items,
            item => Assert.Null(item.SupportsAutoGrading));
    }

    [Fact]
    public void Merge_NeverReturnsAFullyHiddenList()
    {
        // Validation rejects this on save; this guards an already-bad row from stranding an author
        // with an empty dropdown and no way back.
        var json = Overrides(InterviewTaxonomy.CodingLanguages,
            [("Python", "Python", true), ("SQL", "SQL", true)]);

        var items = InterviewTaxonomyMerger.Merge(json, 1).Lists[InterviewTaxonomy.CodingLanguages].Items;

        Assert.Contains(items, i => !i.Hidden);
    }

    [Fact]
    public void Merge_LockedLists_ExposeEveryEnumMember()
    {
        var result = InterviewTaxonomyMerger.Merge(null, 0);

        // The backend counterpart of the frontend's Record<QuestionType, true> guard: adding an
        // enum member without surfacing it here fails right away.
        Assert.Equal(Enum.GetValues<QuestionType>().Length, result.Lists[InterviewTaxonomy.QuestionTypes].Items.Count);
        Assert.Equal(Enum.GetNames<GradingMethod>().Length, result.Lists[InterviewTaxonomy.GradingMethods].Items.Count);
        Assert.Equal(Enum.GetNames<TestStatus>().Length, result.Lists[InterviewTaxonomy.TestStatuses].Items.Count);

        // And the wire strings must be the contract form, not the enum member name.
        Assert.Contains(result.Lists[InterviewTaxonomy.QuestionTypes].Items, i => i.Value == "Frontend Project");
        Assert.Contains(result.Lists[InterviewTaxonomy.QuestionTypes].Items, i => i.Value == "Multiple Choice");
        Assert.Contains(result.Lists[InterviewTaxonomy.GradingMethods].Items, i => i.Value == "Auto-graded");
    }

    [Fact]
    public void Merge_MarksLockedListsLockedAndOpenListsNot()
    {
        var result = InterviewTaxonomyMerger.Merge(null, 0);

        Assert.True(result.Lists[InterviewTaxonomy.QuestionTypes].Locked);
        Assert.False(result.Lists[InterviewTaxonomy.CodingLanguages].Locked);

        // Difficulties and disciplines are pure labels with no behaviour attached, so they were
        // converted from enums to plain strings and are fully editable.
        Assert.False(result.Lists[InterviewTaxonomy.Difficulties].Locked);
        Assert.False(result.Lists[InterviewTaxonomy.Disciplines].Locked);
    }

    private static string Overrides(string key, (string Value, string Label, bool Hidden)[] items) =>
        JsonSerializer.Serialize(
            new Dictionary<string, object>
            {
                [key] = items.Select(i => new { value = i.Value, label = i.Label, hidden = i.Hidden }).ToArray(),
            });
}
