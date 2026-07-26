namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>
/// Supported content groups in an evaluation template.
/// Skills is reserved until the skills capability supplies its content model.
/// </summary>
public enum EvaluationSectionType
{
    Objectives,
    CustomQuestions,
    OverallComments,
    Skills
}
