using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Features.Evaluations.Configuration.Dtos;

public sealed record EvaluationRatingScaleLevelInput(
    Guid? Id,
    string Label,
    string? Description,
    string? BehavioralGuidance);

public sealed record EvaluationRatingScaleLevelDto(
    Guid Id,
    int Ordinal,
    int Value,
    string Label,
    string? Description,
    string? BehavioralGuidance);

public sealed record EvaluationRatingScaleDto(
    Guid Id,
    string Name,
    string? Description,
    string Status,
    bool IsInUse,
    uint Version,
    IReadOnlyList<EvaluationRatingScaleLevelDto> Levels);

public sealed record EvaluationTemplateQuestionInput(
    Guid? Id,
    string Prompt,
    EvaluationQuestionType Type,
    bool IsRequired,
    EvaluationTargetRater TargetRater,
    bool AllowNotApplicable);

public sealed record EvaluationTemplateSectionInput(
    Guid? Id,
    EvaluationSectionType Type,
    string Title,
    string? Guidance,
    IReadOnlyList<EvaluationTemplateQuestionInput> Questions);

public sealed record EvaluationTemplateQuestionDto(
    Guid Id,
    int Ordinal,
    string Prompt,
    string Type,
    bool IsRequired,
    string TargetRater,
    bool AllowNotApplicable);

public sealed record EvaluationTemplateSectionDto(
    Guid Id,
    int Ordinal,
    string Type,
    string Title,
    string? Guidance,
    IReadOnlyList<EvaluationTemplateQuestionDto> Questions);

public sealed record EvaluationTemplateDto(
    Guid Id,
    string Name,
    string? Purpose,
    string? ParticipantInstructions,
    string Status,
    bool IsInUse,
    uint Version,
    IReadOnlyList<EvaluationTemplateSectionDto> Sections);

public static class EvaluationConfigurationMapper
{
    public static EvaluationRatingScaleDto ToDto(EvaluationRatingScale scale) => new(
        scale.Id,
        scale.Name,
        scale.Description,
        scale.Status.ToString(),
        scale.IsInUse,
        scale.Version,
        scale.Levels.Select(level => new EvaluationRatingScaleLevelDto(
            level.Id,
            level.Ordinal,
            level.Value,
            level.Label,
            level.Description,
            level.BehavioralGuidance)).ToArray());

    public static EvaluationTemplateDto ToDto(EvaluationTemplate template) => new(
        template.Id,
        template.Name,
        template.Purpose,
        template.ParticipantInstructions,
        template.Status.ToString(),
        template.IsInUse,
        template.Version,
        template.Sections.Select(section => new EvaluationTemplateSectionDto(
            section.Id,
            section.Ordinal,
            section.Type.ToString(),
            section.Title,
            section.Guidance,
            template.Questions
                .Where(question => question.SectionId == section.Id)
                .Select(question => new EvaluationTemplateQuestionDto(
                    question.Id,
                    question.Ordinal,
                    question.Prompt,
                    question.Type.ToString(),
                    question.IsRequired,
                    question.TargetRater.ToString(),
                    question.AllowNotApplicable))
                .ToArray())).ToArray());
}
