using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class EvaluationTemplateSection : BaseEntity, ITenantEntity
{
    public const int TitleMaxLength = 120;
    public const int GuidanceMaxLength = 500;

    private EvaluationTemplateSection() { }

    public Guid TenantId { get; private set; }
    public Guid TemplateId { get; private set; }
    public EvaluationSectionType Type { get; private set; }
    public int Ordinal { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Guidance { get; private set; }

    internal static EvaluationTemplateSection Create(
        Guid tenantId,
        Guid templateId,
        EvaluationSectionType type,
        int ordinal,
        string title,
        string? guidance)
    {
        if (!Enum.IsDefined(type) || type == EvaluationSectionType.Skills)
            throw new DomainRuleViolationException("The selected evaluation section type is not available.");

        var section = new EvaluationTemplateSection
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            TemplateId = templateId,
            Type = type
        };
        section.Update(ordinal, title, guidance);
        return section;
    }

    internal void Update(int ordinal, string title, string? guidance)
    {
        if (ordinal < 1)
            throw new DomainRuleViolationException("A template section ordinal must be positive.");

        Ordinal = ordinal;
        Title = NormalizeRequired(title, nameof(title), TitleMaxLength);
        Guidance = NormalizeOptional(guidance, nameof(guidance), GuidanceMaxLength);
        UpdatedAt = DateTime.UtcNow;
    }

    internal void SetOrdinal(int ordinal)
    {
        if (ordinal < 1)
            throw new DomainRuleViolationException("A template section ordinal must be positive.");

        Ordinal = ordinal;
        UpdatedAt = DateTime.UtcNow;
    }

    private static string NormalizeRequired(string value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new DomainRuleViolationException("A template section requires a title.");

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"{paramName} cannot exceed {maxLength} characters.", paramName);

        return trimmed;
    }

    private static string? NormalizeOptional(string? value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"{paramName} cannot exceed {maxLength} characters.", paramName);

        return trimmed;
    }
}

public sealed record EvaluationTemplateSectionDraft(
    EvaluationSectionType Type,
    string Title,
    string? Guidance = null);
