using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Domain.Defaults;

/// <summary>
/// Product-authored starter definitions. Every call creates independent tenant-owned
/// aggregates; these definitions are never persisted or shared as mutable customer data.
/// </summary>
public static class EvaluationConfigurationDefaults
{
    public const string DefaultScaleName = "Five-level performance scale";
    public const string DefaultTemplateName = "Starter annual evaluation";

    public static TenantEvaluationConfigurationDefaults InstantiateForTenant(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant is required.", nameof(tenantId));

        var scale = EvaluationRatingScale.CreateDraft(
            tenantId,
            DefaultScaleName,
            "A balanced five-level scale for consistent annual performance conversations.",
            [
                new(
                    "Does not meet expectations",
                    "Results or behaviors consistently fall short of the role's expectations.",
                    "Use specific evidence and identify the support or correction required."),
                new(
                    "Partially meets expectations",
                    "Some expectations are met, with material gaps in consistency or outcomes.",
                    "Recognize progress and name the few gaps that most affect performance."),
                new(
                    "Meets expectations",
                    "Consistently delivers the outcomes and behaviors expected for the role.",
                    "Anchor the rating in sustained delivery, not a single recent event."),
                new(
                    "Exceeds expectations",
                    "Frequently delivers impact beyond the role's normal expectations.",
                    "Describe the additional scope, quality, or influence demonstrated."),
                new(
                    "Significantly exceeds expectations",
                    "Sustained, exceptional impact materially raises outcomes for the wider team.",
                    "Reserve this level for clear evidence of uncommon and repeatable contribution.")
            ]);
        scale.Activate();

        var template = EvaluationTemplate.CreateDraft(
            tenantId,
            DefaultTemplateName,
            "A focused annual review of objectives, contribution, and forward priorities.",
            "Use specific examples from the review period and keep feedback factual and actionable.");

        template.AddSection(new EvaluationTemplateSectionDraft(
            EvaluationSectionType.Objectives,
            "Objectives",
            "Review progress against the approved objective baseline."));
        var questions = template.AddSection(new EvaluationTemplateSectionDraft(
            EvaluationSectionType.CustomQuestions,
            "Reflection and contribution",
            "Capture the context behind the results and the priorities ahead."));
        template.AddQuestion(
            questions.Id,
            new EvaluationTemplateQuestionDraft(
                "What accomplishments had the greatest impact during this review period?",
                EvaluationQuestionType.Text,
                true,
                EvaluationTargetRater.Both));
        template.AddQuestion(
            questions.Id,
            new EvaluationTemplateQuestionDraft(
                "What should be the most important development priority for the next review period?",
                EvaluationQuestionType.Text,
                true,
                EvaluationTargetRater.Both));
        template.AddSection(new EvaluationTemplateSectionDraft(
            EvaluationSectionType.OverallComments,
            "Overall comments",
            "Summarize the evaluation with clear evidence and next steps."));
        template.Activate();

        return new TenantEvaluationConfigurationDefaults(scale, template);
    }
}

public sealed record TenantEvaluationConfigurationDefaults(
    EvaluationRatingScale RatingScale,
    EvaluationTemplate Template);
