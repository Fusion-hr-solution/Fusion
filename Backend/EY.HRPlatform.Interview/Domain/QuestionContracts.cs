using EY.HRPlatform.Interview.Domain.Enums;

namespace EY.HRPlatform.Interview.Domain;

/// <summary>
/// Enum → wire-string mapping for the question contract shared with the frontend
/// (its <c>QuestionType</c> / <c>GradingMethod</c> unions).
/// </summary>
/// <remarks>
/// Single definition on purpose. This mapping was previously copy-pasted into four services and
/// two of the copies never learned about <see cref="QuestionType.FrontendProject"/>, so those
/// endpoints emitted the raw enum name "FrontendProject". The frontend doesn't recognise that
/// value and silently degrades it to "Essay".
///
/// A member whose contract string is more than one word MUST get an explicit case here — the
/// default arm returns the enum name, which is only correct for single-word members.
/// </remarks>
public static class QuestionContracts
{
    public static string ToContract(QuestionType type) => type switch
    {
        QuestionType.Sql => "SQL",
        QuestionType.MultipleChoice => "Multiple Choice",
        QuestionType.CaseStudy => "Case Study",
        QuestionType.TrueFalse => "True/False",
        QuestionType.FrontendProject => "Frontend Project",
        _ => type.ToString(),
    };

    public static string ToContract(GradingMethod method) => method switch
    {
        GradingMethod.AutoGraded => "Auto-graded",
        _ => method.ToString(),
    };
}
