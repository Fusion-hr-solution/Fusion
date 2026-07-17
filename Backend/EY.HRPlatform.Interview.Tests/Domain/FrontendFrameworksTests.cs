using EY.HRPlatform.Interview.Domain;

namespace EY.HRPlatform.Interview.Tests.Domain;

public class FrontendFrameworksTests
{
    [Theory]
    [InlineData("react", "react")]
    [InlineData("React", "react")]
    [InlineData("  ANGULAR ", "angular")]
    [InlineData("next", "next")]
    [InlineData("Next.js", "next")]
    [InlineData("nextjs", "next")]
    public void Resolve_CanonicalizesSupportedFrameworks(string input, string expected) =>
        Assert.Equal(expected, FrontendFrameworks.Resolve(input));

    [Theory]
    [InlineData("vue")]
    [InlineData("svelte")]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Resolve_ReturnsNull_ForUnsupportedOrEmpty(string? input) =>
        Assert.Null(FrontendFrameworks.Resolve(input));
}
