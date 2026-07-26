using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class EvaluationRoundScaleSnapshot : BaseEntity, ITenantEntity
{
    private readonly List<EvaluationRoundScaleSnapshotLevel> _levels = new();
    private EvaluationRoundScaleSnapshot() { }

    public Guid TenantId { get; private set; }
    public Guid RoundId { get; private set; }
    public Guid SourceRatingScaleId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public IReadOnlyCollection<EvaluationRoundScaleSnapshotLevel> Levels => _levels.OrderBy(x => x.Ordinal).ToArray();

    internal static EvaluationRoundScaleSnapshot Capture(
        Guid tenantId,
        Guid roundId,
        Guid sourceRatingScaleId,
        string name,
        string? description,
        IEnumerable<EvaluationRoundScaleDraftLevel> levels)
    {
        var snapshot = new EvaluationRoundScaleSnapshot
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoundId = roundId,
            SourceRatingScaleId = sourceRatingScaleId,
            Name = name,
            Description = description
        };
        snapshot._levels.AddRange(levels.OrderBy(x => x.Ordinal).Select(level =>
            EvaluationRoundScaleSnapshotLevel.Capture(tenantId, snapshot.Id, level)));
        return snapshot;
    }
}

public sealed class EvaluationRoundScaleSnapshotLevel : BaseEntity, ITenantEntity
{
    private EvaluationRoundScaleSnapshotLevel() { }
    public Guid TenantId { get; private set; }
    public Guid ScaleSnapshotId { get; private set; }
    public Guid SourceLevelId { get; private set; }
    public int Ordinal { get; private set; }
    public int Value => Ordinal;
    public string Label { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string? BehavioralGuidance { get; private set; }

    internal static EvaluationRoundScaleSnapshotLevel Capture(
        Guid tenantId,
        Guid scaleSnapshotId,
        EvaluationRoundScaleDraftLevel level) => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ScaleSnapshotId = scaleSnapshotId,
            SourceLevelId = level.SourceLevelId,
            Ordinal = level.Ordinal,
            Label = level.Label,
            Description = level.Description,
            BehavioralGuidance = level.BehavioralGuidance
        };
}

public sealed class EvaluationRoundTemplateSnapshot : BaseEntity, ITenantEntity
{
    private readonly List<EvaluationRoundTemplateSnapshotSection> _sections = new();
    private readonly List<EvaluationRoundTemplateSnapshotQuestion> _questions = new();
    private EvaluationRoundTemplateSnapshot() { }

    public Guid TenantId { get; private set; }
    public Guid RoundId { get; private set; }
    public Guid SourceTemplateId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Purpose { get; private set; }
    public string? ParticipantInstructions { get; private set; }
    public IReadOnlyCollection<EvaluationRoundTemplateSnapshotSection> Sections => _sections.OrderBy(x => x.Ordinal).ToArray();
    public IReadOnlyCollection<EvaluationRoundTemplateSnapshotQuestion> Questions => _questions.OrderBy(x => x.Ordinal).ToArray();

    internal static EvaluationRoundTemplateSnapshot Capture(
        Guid tenantId,
        Guid roundId,
        Guid sourceTemplateId,
        string name,
        string? purpose,
        string? instructions,
        IEnumerable<EvaluationRoundTemplateDraftSection> sections,
        IEnumerable<EvaluationRoundTemplateDraftQuestion> questions)
    {
        var snapshot = new EvaluationRoundTemplateSnapshot
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoundId = roundId,
            SourceTemplateId = sourceTemplateId,
            Name = name,
            Purpose = purpose,
            ParticipantInstructions = instructions
        };
        var sectionMap = new Dictionary<Guid, Guid>();
        foreach (var section in sections.OrderBy(x => x.Ordinal))
        {
            var captured = EvaluationRoundTemplateSnapshotSection.Capture(tenantId, snapshot.Id, section);
            snapshot._sections.Add(captured);
            sectionMap[section.Id] = captured.Id;
        }
        snapshot._questions.AddRange(questions.Select(question =>
            EvaluationRoundTemplateSnapshotQuestion.Capture(
                tenantId,
                snapshot.Id,
                sectionMap[question.DraftSectionId],
                question)));
        return snapshot;
    }
}

public sealed class EvaluationRoundTemplateSnapshotSection : BaseEntity, ITenantEntity
{
    private EvaluationRoundTemplateSnapshotSection() { }
    public Guid TenantId { get; private set; }
    public Guid TemplateSnapshotId { get; private set; }
    public Guid SourceSectionId { get; private set; }
    public EvaluationSectionType Type { get; private set; }
    public int Ordinal { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Guidance { get; private set; }

    internal static EvaluationRoundTemplateSnapshotSection Capture(
        Guid tenantId,
        Guid templateSnapshotId,
        EvaluationRoundTemplateDraftSection section) => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            TemplateSnapshotId = templateSnapshotId,
            SourceSectionId = section.SourceSectionId,
            Type = section.Type,
            Ordinal = section.Ordinal,
            Title = section.Title,
            Guidance = section.Guidance
        };
}

public sealed class EvaluationRoundTemplateSnapshotQuestion : BaseEntity, ITenantEntity
{
    private EvaluationRoundTemplateSnapshotQuestion() { }
    public Guid TenantId { get; private set; }
    public Guid TemplateSnapshotId { get; private set; }
    public Guid SectionSnapshotId { get; private set; }
    public Guid SourceQuestionId { get; private set; }
    public int Ordinal { get; private set; }
    public string Prompt { get; private set; } = string.Empty;
    public EvaluationQuestionType Type { get; private set; }
    public bool IsRequired { get; private set; }
    public EvaluationTargetRater TargetRater { get; private set; }
    public bool AllowNotApplicable { get; private set; }

    internal static EvaluationRoundTemplateSnapshotQuestion Capture(
        Guid tenantId,
        Guid templateSnapshotId,
        Guid sectionSnapshotId,
        EvaluationRoundTemplateDraftQuestion question) => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            TemplateSnapshotId = templateSnapshotId,
            SectionSnapshotId = sectionSnapshotId,
            SourceQuestionId = question.SourceQuestionId,
            Ordinal = question.Ordinal,
            Prompt = question.Prompt,
            Type = question.Type,
            IsRequired = question.IsRequired,
            TargetRater = question.TargetRater,
            AllowNotApplicable = question.AllowNotApplicable
        };
}

public sealed class EvaluationRoundPolicySnapshot : BaseEntity, ITenantEntity
{
    private EvaluationRoundPolicySnapshot() { }
    public Guid TenantId { get; private set; }
    public Guid RoundId { get; private set; }
    public EvaluationAssessmentModel AssessmentModel { get; private set; }
    public EvaluationVisibilityModel VisibilityModel { get; private set; }
    public DateTime? SelfAssessmentDeadline { get; private set; }
    public DateTime ManagerAssessmentDeadline { get; private set; }
    public DateTime FinalizationDeadline { get; private set; }
    public int ObjectivesWeightPercent { get; private set; } = 100;
    public int SkillsWeightPercent { get; private set; }

    internal static EvaluationRoundPolicySnapshot Capture(
        Guid tenantId,
        Guid roundId,
        EvaluationAssessmentModel model,
        DateTime? selfDeadline,
        DateTime managerDeadline,
        DateTime finalizationDeadline,
        int objectivesWeightPercent,
        int skillsWeightPercent) => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoundId = roundId,
            AssessmentModel = model,
            VisibilityModel = model == EvaluationAssessmentModel.SelfAndManager
                ? EvaluationVisibilityModel.SelfThenManager
                : EvaluationVisibilityModel.ManagerImmediate,
            SelfAssessmentDeadline = selfDeadline,
            ManagerAssessmentDeadline = managerDeadline,
            FinalizationDeadline = finalizationDeadline,
            ObjectivesWeightPercent = objectivesWeightPercent,
            SkillsWeightPercent = skillsWeightPercent
        };
}
