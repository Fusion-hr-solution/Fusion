namespace EY.HRPlatform.Training.Features.Admin.Quiz;

/// <summary>
/// US-8.2.5 — a single quiz question carried in a save-draft / publish request. Shared by
/// <see cref="SaveQuizDraftCommand"/> (persists scratch space) and <see cref="PublishQuizCommand"/>
/// (creates exam questions). The same shape as <c>QuizDraftQuestionDto</c> but as an immutable input.
/// </summary>
public record QuizQuestionInput(
    string Text,
    string Type,
    int Points,
    string? Explanation,
    string? Source,
    IReadOnlyList<QuizOptionInput> Options);

public record QuizOptionInput(string Text, bool IsCorrect);
