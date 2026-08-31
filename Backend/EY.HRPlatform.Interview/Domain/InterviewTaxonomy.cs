using EY.HRPlatform.Interview.Domain.Enums;

namespace EY.HRPlatform.Interview.Domain;

/// <summary>One option in an admin-curated dropdown list.</summary>
/// <param name="Value">The wire value. For a locked list this is pinned to a C# enum member and
/// is what the API accepts; admins may never change it.</param>
/// <param name="Label">What an author sees. Defaults to the value.</param>
public sealed record TaxonomyDefault(string Value, string Label)
{
    public TaxonomyDefault(string value) : this(value, value) { }
}

/// <summary>
/// The canonical catalogue of admin-curatable dropdown lists.
/// </summary>
/// <remarks>
/// Locked lists are contract-bound: their values are parsed by <c>switch</c> expressions that throw
/// 400 on anything unrecognised, and the enum member name is what is persisted. Settings may
/// therefore only relabel, reorder and hide them — never add or remove.
///
/// Their defaults are DERIVED from the enums rather than hand-listed, so a new enum member cannot be
/// forgotten here. That is the backend counterpart of the frontend's <c>Record&lt;QuestionType, true&gt;</c>
/// exhaustiveness guard. The two multi-word enums go through <see cref="QuestionContracts.ToContract(QuestionType)"/>;
/// the rest have single-word members whose name IS the wire string.
/// </remarks>
public static class InterviewTaxonomy
{
    public const string Disciplines = "disciplines";
    public const string QuestionTypes = "questionTypes";
    public const string Difficulties = "difficulties";
    public const string GradingMethods = "gradingMethods";
    public const string TestStatuses = "testStatuses";
    public const string FrontendFrameworks = "frontendFrameworks";
    public const string CodingLanguages = "codingLanguages";
    public const string QuestionTags = "questionTags";

    /// <remarks>
    /// Locked because each value is wired to behaviour: question types have bespoke authoring UI and
    /// grader routing, grading methods change how a question is scored, statuses drive lifecycle
    /// logic, and each frontend framework needs its own grading image. Difficulties and disciplines
    /// are deliberately NOT here — they are pure labels, so they were converted from enums to plain
    /// strings and are fully editable.
    /// </remarks>
    private static readonly string[] LockedKeys =
    [
        QuestionTypes, GradingMethods, TestStatuses, FrontendFrameworks,
    ];

    private static readonly string[] OpenKeys =
    [
        Difficulties, Disciplines, CodingLanguages, QuestionTags,
    ];

    /// <summary>Seed values for the open lists. Unlike locked defaults these are a starting point:
    /// once an admin saves, their list replaces this wholesale and deletions stick.</summary>
    private static readonly string[] CodingLanguageSeeds =
    [
        "Python", "JavaScript", "TypeScript", "Java", "C++", "Go", "Rust", "SQL", "Bash",
    ];

    private static readonly string[] DifficultySeeds = ["Easy", "Medium", "Hard", "Expert"];

    private static readonly string[] DisciplineSeeds =
    [
        "Engineering", "Design", "Product", "Data", "Marketing", "Sales", "Operations", "Finance", "HR",
    ];

    public static IReadOnlyList<string> Keys { get; } = [.. LockedKeys, .. OpenKeys];

    public static bool IsKnownKey(string? key) =>
        key is not null && Keys.Contains(key, StringComparer.Ordinal);

    public static bool IsLocked(string key) => LockedKeys.Contains(key, StringComparer.Ordinal);

    public static IReadOnlyList<TaxonomyDefault> DefaultsFor(string key) => key switch
    {
        QuestionTypes => [.. Enum.GetValues<QuestionType>().Select(t => new TaxonomyDefault(QuestionContracts.ToContract(t)))],
        GradingMethods => [.. Enum.GetValues<GradingMethod>().Select(m => new TaxonomyDefault(QuestionContracts.ToContract(m)))],
        Difficulties => [.. DifficultySeeds.Select(d => new TaxonomyDefault(d))],
        Disciplines => [.. DisciplineSeeds.Select(d => new TaxonomyDefault(d))],
        TestStatuses => [.. Enum.GetNames<TestStatus>().Select(n => new TaxonomyDefault(n))],
        FrontendFrameworks =>
        [
            new(Domain.FrontendFrameworks.React, "React"),
            new(Domain.FrontendFrameworks.Angular, "Angular"),
            new(Domain.FrontendFrameworks.Next, "Next.js"),
        ],
        CodingLanguages => [.. CodingLanguageSeeds.Select(l => new TaxonomyDefault(l))],
        QuestionTags => [],
        _ => [],
    };

    /// <summary>
    /// Whether a value may appear in this list. For locked lists this is the same set the write path
    /// accepts, so Settings can never persist an option that would 400 on use.
    /// </summary>
    public static bool IsValidValue(string key, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return false;

        if (!IsLocked(key))
            return true;

        return DefaultsFor(key).Any(d => string.Equals(d.Value, value, StringComparison.Ordinal));
    }
}
