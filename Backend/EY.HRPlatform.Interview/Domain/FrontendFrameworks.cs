namespace EY.HRPlatform.Interview.Domain;

/// <summary>
/// Single source of truth for the frameworks a Frontend Project question supports. Both authoring
/// validation (<c>QuestionService</c>) and grading (<c>FrontendProjectGrader</c> → Docker image
/// lookup) resolve through here, so the supported set can't drift between them — adding a framework
/// in one place but not the other used to mean a question graded against the wrong image.
/// </summary>
public static class FrontendFrameworks
{
    public const string React = "react";
    public const string Angular = "angular";
    public const string Next = "next";

    /// <summary>
    /// Canonicalizes a framework string to one of the supported values, or null if unsupported.
    /// Case-insensitive; accepts the "next.js"/"nextjs" aliases for <see cref="Next"/>.
    /// </summary>
    public static string? Resolve(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        React => React,
        Angular => Angular,
        Next or "next.js" or "nextjs" => Next,
        _ => null,
    };
}
