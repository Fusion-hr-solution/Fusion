using EY.HRPlatform.Performance.Domain;

namespace EY.HRPlatform.Performance.Tests.Domain;

public sealed class CampaignSlugTests
{
    [Theory]
    [InlineData("Annual Planning", "annual-planning")]
    [InlineData("  FY26   Planning!!  ", "fy26-planning")]
    [InlineData("Revue de Performance à Évaluer", "revue-de-performance-a-evaluer")]
    [InlineData("2026 / 2027 Cycle", "2026-2027-cycle")]
    [InlineData("---", "")]
    public void Slugify_NormalizesToUrlSafeStem(string input, string expected)
    {
        Assert.Equal(expected, CampaignSlug.Slugify(input));
    }

    [Fact]
    public void From_AppendsReferenceYear()
    {
        Assert.Equal("annual-planning-2026", CampaignSlug.From("Annual Planning", 2026));
    }

    [Fact]
    public void From_FallsBackToYearWhenNameHasNoSlugStem()
    {
        Assert.Equal("2026", CampaignSlug.From("!!!", 2026));
    }

    [Fact]
    public void Unique_ReturnsBaseWhenFree()
    {
        Assert.Equal("annual-planning-2026", CampaignSlug.Unique("annual-planning-2026", []));
    }

    [Fact]
    public void Unique_AppendsIncrementingSuffixOnCollision()
    {
        var existing = new[] { "annual-planning-2026", "annual-planning-2026-2" };
        Assert.Equal("annual-planning-2026-3", CampaignSlug.Unique("annual-planning-2026", existing));
    }

    [Fact]
    public void Unique_IsCaseInsensitive()
    {
        Assert.Equal("annual-2026-2", CampaignSlug.Unique("annual-2026", new[] { "ANNUAL-2026" }));
    }
}
