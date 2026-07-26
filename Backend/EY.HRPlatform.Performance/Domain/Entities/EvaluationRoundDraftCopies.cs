using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class EvaluationRoundScaleDraftLevel : BaseEntity, ITenantEntity
{
    private EvaluationRoundScaleDraftLevel() { }

    public Guid TenantId { get; private set; }
    public Guid RoundId { get; private set; }
    public Guid SourceLevelId { get; private set; }
    public int Ordinal { get; private set; }
    public int Value => Ordinal;
    public string Label { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string? BehavioralGuidance { get; private set; }

    internal static EvaluationRoundScaleDraftLevel Copy(
        Guid tenantId,
        Guid roundId,
        EvaluationRatingScaleLevel source) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoundId = roundId,
            SourceLevelId = source.Id,
            Ordinal = source.Ordinal,
            Label = source.Label,
            Description = source.Description,
            BehavioralGuidance = source.BehavioralGuidance
        };

    internal void Update(string label, string? description, string? behavioralGuidance)
    {
        var updated = EvaluationRatingScaleLevel.Create(
            TenantId,
            RoundId,
            Ordinal,
            label,
            description,
            behavioralGuidance);
        Label = updated.Label;
        Description = updated.Description;
        BehavioralGuidance = updated.BehavioralGuidance;
        UpdatedAt = DateTime.UtcNow;
    }

    internal void SetOrdinal(int ordinal)
    {
        Ordinal = ordinal;
        UpdatedAt = DateTime.UtcNow;
    }
}

public sealed class EvaluationRoundTemplateDraftSection : BaseEntity, ITenantEntity
{
    private EvaluationRoundTemplateDraftSection() { }

    public Guid TenantId { get; private set; }
    public Guid RoundId { get; private set; }
    public Guid SourceSectionId { get; private set; }
    public EvaluationSectionType Type { get; private set; }
    public int Ordinal { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Guidance { get; private set; }

    internal static EvaluationRoundTemplateDraftSection Copy(
        Guid tenantId,
        Guid roundId,
        EvaluationTemplateSection source) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoundId = roundId,
            SourceSectionId = source.Id,
            Type = source.Type,
            Ordinal = source.Ordinal,
            Title = source.Title,
            Guidance = source.Guidance
        };

    internal void Update(string title, string? guidance)
    {
        var updated = EvaluationTemplateSection.Create(TenantId, RoundId, Type, Ordinal, title, guidance);
        Title = updated.Title;
        Guidance = updated.Guidance;
        UpdatedAt = DateTime.UtcNow;
    }
}

public sealed class EvaluationRoundTemplateDraftQuestion : BaseEntity, ITenantEntity
{
    private EvaluationRoundTemplateDraftQuestion() { }

    public Guid TenantId { get; private set; }
    public Guid RoundId { get; private set; }
    public Guid DraftSectionId { get; private set; }
    public Guid SourceQuestionId { get; private set; }
    public int Ordinal { get; private set; }
    public string Prompt { get; private set; } = string.Empty;
    public EvaluationQuestionType Type { get; private set; }
    public bool IsRequired { get; private set; }
    public EvaluationTargetRater TargetRater { get; private set; }
    public bool AllowNotApplicable { get; private set; }

    internal static EvaluationRoundTemplateDraftQuestion Copy(
        Guid tenantId,
        Guid roundId,
        Guid draftSectionId,
        EvaluationTemplateQuestion source) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoundId = roundId,
            DraftSectionId = draftSectionId,
            SourceQuestionId = source.Id,
            Ordinal = source.Ordinal,
            Prompt = source.Prompt,
            Type = source.Type,
            IsRequired = source.IsRequired,
            TargetRater = source.TargetRater,
            AllowNotApplicable = source.AllowNotApplicable
        };

    internal void Update(EvaluationTemplateQuestionDraft draft)
    {
        var updated = EvaluationTemplateQuestion.Create(
            TenantId,
            RoundId,
            DraftSectionId,
            Ordinal,
            draft.Prompt,
            draft.Type,
            draft.IsRequired,
            draft.TargetRater,
            draft.AllowNotApplicable);
        Prompt = updated.Prompt;
        Type = updated.Type;
        IsRequired = updated.IsRequired;
        TargetRater = updated.TargetRater;
        AllowNotApplicable = updated.AllowNotApplicable;
        UpdatedAt = DateTime.UtcNow;
    }
}
