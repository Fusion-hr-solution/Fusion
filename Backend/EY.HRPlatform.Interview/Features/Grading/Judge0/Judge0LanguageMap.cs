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

    public static int Resolve(string? language) => language?.Trim().ToLowerInvariant() switch
    {
        "javascript" or "js" => 63,
        "typescript" or "ts" => 74,
        "python" => 71,
        "java" => 62,
        "csharp" or "c#" => 51,
        "cpp" or "c++" => 54,
        "sql" => 82,
        _ => DefaultLanguageId
    };

    /// <summary>
    /// Resolves the Judge0 language for a question. SQL questions always run on Judge0's
    /// SQL (SQLite) regardless of the stored language string — which may be empty or a
    /// dialect name like "PostgreSQL" that <see cref="Resolve"/> wouldn't recognize.
    /// </summary>
    public static int ResolveForQuestion(QuestionType type, string? language) =>
        type == QuestionType.Sql ? SqlLanguageId : Resolve(language);
}
