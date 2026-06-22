using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Grading.Judge0;

namespace EY.HRPlatform.Interview.Tests.Features.Grading;

public class Judge0LanguageMapTests
{
    [Theory]
    [InlineData("python", 71)]
    [InlineData("Python", 71)]
    [InlineData("  python  ", 71)]
    [InlineData("javascript", 63)]
    [InlineData("js", 63)]
    [InlineData("typescript", 74)]
    [InlineData("ts", 74)]
    [InlineData("java", 62)]
    [InlineData("c#", 51)]
    [InlineData("csharp", 51)]
    [InlineData("c++", 54)]
    [InlineData("cpp", 54)]
    [InlineData("sql", 82)]
    public void Resolve_MapsKnownLanguages(string language, int expected)
    {
        Assert.Equal(expected, Judge0LanguageMap.Resolve(language));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("cobol")]
    public void Resolve_DefaultsToPython_ForUnknownOrMissing(string? language)
    {
        Assert.Equal(Judge0LanguageMap.DefaultLanguageId, Judge0LanguageMap.Resolve(language));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("sql")]
    [InlineData("PostgreSQL")] // dialect names must still map to SQLite, not the Python default
    [InlineData("mysql")]
    public void ResolveForQuestion_SqlType_AlwaysUsesSqlite(string? language)
    {
        Assert.Equal(Judge0LanguageMap.SqlLanguageId, Judge0LanguageMap.ResolveForQuestion(QuestionType.Sql, language));
    }

    [Theory]
    [InlineData("python", 71)]
    [InlineData("java", 62)]
    [InlineData(null, Judge0LanguageMap.DefaultLanguageId)]
    public void ResolveForQuestion_CodingType_UsesLanguageString(string? language, int expected)
    {
        Assert.Equal(expected, Judge0LanguageMap.ResolveForQuestion(QuestionType.Coding, language));
    }
}
