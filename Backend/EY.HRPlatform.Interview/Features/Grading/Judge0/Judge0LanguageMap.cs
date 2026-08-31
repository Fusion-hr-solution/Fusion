using EY.HRPlatform.Interview.Domain.Enums;

namespace EY.HRPlatform.Interview.Features.Grading.Judge0;

/// <summary>
/// Maps a human language name (as stored on a <c>Question</c>) to a Judge0 language id.
/// Single source of truth shared by auto-grading (<c>Judge0Grader</c>) and the candidate
/// "run code" path so the two never drift.
/// </summary>
public static class Judge0LanguageMap
{
    public const int DefaultLanguageId = 71; // Python 3
    public const int SqlLanguageId = 82;     // SQLite

    public static int Resolve(string? language) => TryResolve(language, out var id) ? id : DefaultLanguageId;

    /// <summary>
    /// Resolves a language, reporting whether it was actually recognised. <see cref="Resolve"/>
    /// silently falls back to Python for anything unknown, which means an unsupported language
    /// executes every submission through the wrong interpreter and scores 0 with no error. Callers
    /// that can warn a human — the taxonomy Settings page — need to see that distinction.
    /// </summary>
    public static bool TryResolve(string? language, out int languageId)
    {
        languageId = language?.Trim().ToLowerInvariant() switch
        {
            "javascript" or "js" => 63,
            "typescript" or "ts" => 74,
            "python" => 71,
            "java" => 62,
            "csharp" or "c#" => 51,
            "cpp" or "c++" => 54,
            "sql" => 82,
            _ => 0
        };

        if (languageId != 0)
            return true;

        languageId = DefaultLanguageId;
        return false;
    }

    /// <summary>True when the grader can actually run this language, rather than falling back to Python.</summary>
    public static bool IsSupported(string? language) => TryResolve(language, out _);

    /// <summary>
    /// Resolves the Judge0 language for a question. SQL questions always run on Judge0's
    /// SQL (SQLite) regardless of the stored language string — which may be empty or a
    /// dialect name like "PostgreSQL" that <see cref="Resolve"/> wouldn't recognize.
    /// </summary>
    public static int ResolveForQuestion(QuestionType type, string? language) =>
        type == QuestionType.Sql ? SqlLanguageId : Resolve(language);
}
