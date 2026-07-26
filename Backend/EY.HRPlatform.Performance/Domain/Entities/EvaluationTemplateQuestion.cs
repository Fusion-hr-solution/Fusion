using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class EvaluationTemplateQuestion : BaseEntity, ITenantEntity
{
    public const int PromptMaxLength = 500;

    private EvaluationTemplateQuestion() { }

    public Guid TenantId { get; private set; }
    public Guid TemplateId { get; private set; }
    public Guid SectionId { get; private set; }
    public int Ordinal { get; private set; }
    public string Prompt { get; private set; } = string.Empty;
    public EvaluationQuestionType Type { get; private set; }
    public bool IsRequired { get; private set; }
    public EvaluationTargetRater TargetRater { get; private set; }
    public bool AllowNotApplicable { get; private set; }

    internal static EvaluationTemplateQuestion Create(
        Guid tenantId,
        Guid templateId,
        Guid sectionId,
        int ordinal,
        string prompt,
        EvaluationQuestionType type,
        bool isRequired,
        EvaluationTargetRater targetRater,
        bool allowNotApplicable)
    {
        var question = new EvaluationTemplateQuestion
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            TemplateId = templateId,
            SectionId = sectionId
        };
        question.Update(ordinal, prompt, type, isRequired, targetRater, allowNotApplicable);
        return question;
    }

    internal void Update(
        int ordinal,
        string prompt,
        EvaluationQuestionType type,
        bool isRequired,
        EvaluationTargetRater targetRater,
        bool allowNotApplicable)
    {
        if (ordinal < 1)
            throw new DomainRuleViolationException("A template question ordinal must be positive.");
        if (!Enum.IsDefined(type))
            throw new DomainRuleViolationException("A question type is required.");
        if (!Enum.IsDefined(targetRater))
            throw new DomainRuleViolationException("A target rater is required.");
        if (type == EvaluationQuestionType.Text && allowNotApplicable)
            throw new DomainRuleViolationException("A text question cannot allow Not applicable.");

        Ordinal = ordinal;
        Prompt = NormalizeRequired(prompt);
        Type = type;
        IsRequired = isRequired;
        TargetRater = targetRater;
        AllowNotApplicable = allowNotApplicable;
        UpdatedAt = DateTime.UtcNow;
    }

    internal void SetOrdinal(int ordinal)
    {
        if (ordinal < 1)
            throw new DomainRuleViolationException("A template question ordinal must be positive.");

        Ordinal = ordinal;
        UpdatedAt = DateTime.UtcNow;
    }

    private static string NormalizeRequired(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new DomainRuleViolationException("A template question requires a prompt.");

        var trimmed = value.Trim();
        if (trimmed.Length > PromptMaxLength)
            throw new ArgumentException($"prompt cannot exceed {PromptMaxLength} characters.", nameof(value));

        return trimmed;
    }
}

public sealed record EvaluationTemplateQuestionDraft(
    string Prompt,
    EvaluationQuestionType Type,
    bool IsRequired,
    EvaluationTargetRater TargetRater,
    bool AllowNotApplicable = false);
