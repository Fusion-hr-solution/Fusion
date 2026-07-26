using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A tenant-owned evaluation blueprint. Sections and questions are directly owned by the
/// aggregate; per-question scales, weights, question banks, and conditional logic do not exist.
/// </summary>
public sealed class EvaluationTemplate : AggregateRoot, ITenantEntity
{
    public const int NameMaxLength = 120;
    public const int PurposeMaxLength = 1000;
    public const int InstructionsMaxLength = 2000;

    private readonly List<EvaluationTemplateSection> _sections = new();
    private readonly List<EvaluationTemplateQuestion> _questions = new();

    private EvaluationTemplate() { }

    public Guid TenantId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Purpose { get; private set; }
    public string? ParticipantInstructions { get; private set; }
    public EvaluationConfigStatus Status { get; private set; }
    public bool IsInUse { get; private set; }
    public uint Version { get; private set; }

    public IReadOnlyCollection<EvaluationTemplateSection> Sections =>
        _sections.OrderBy(section => section.Ordinal).ToArray();

    public IReadOnlyCollection<EvaluationTemplateQuestion> Questions =>
        _questions
            .OrderBy(question => FindSection(question.SectionId).Ordinal)
            .ThenBy(question => question.Ordinal)
            .ToArray();

    public static EvaluationTemplate CreateDraft(
        Guid tenantId,
        string name,
        string? purpose = null,
        string? participantInstructions = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant is required.", nameof(tenantId));

        var template = new EvaluationTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Status = EvaluationConfigStatus.Draft
        };
        template.UpdateDetails(name, purpose, participantInstructions);
        return template;
    }

    public void UpdateDetails(string name, string? purpose, string? participantInstructions)
    {
        EnsureNotArchived();
        Name = NormalizeRequired(name, nameof(name), NameMaxLength);
        Purpose = NormalizeOptional(purpose, nameof(purpose), PurposeMaxLength);
        ParticipantInstructions = NormalizeOptional(
            participantInstructions,
            nameof(participantInstructions),
            InstructionsMaxLength);
        UpdatedAt = DateTime.UtcNow;
    }

    public EvaluationTemplateSection AddSection(EvaluationTemplateSectionDraft section)
    {
        EnsureStructureEditable();
        if (_sections.Any(existing => existing.Type == section.Type))
            throw new DomainRuleViolationException("A template can contain each section type only once.");

        var created = EvaluationTemplateSection.Create(
            TenantId,
            Id,
            section.Type,
            _sections.Count + 1,
            section.Title,
            section.Guidance);
        _sections.Add(created);
        UpdatedAt = DateTime.UtcNow;
        return created;
    }

    public void UpdateSection(Guid sectionId, string title, string? guidance)
    {
        EnsureStructureEditable();
        var section = FindSection(sectionId);
        section.Update(section.Ordinal, title, guidance);
        UpdatedAt = DateTime.UtcNow;
    }

    public void RemoveSection(Guid sectionId)
    {
        EnsureStructureEditable();
        var section = FindSection(sectionId);
        _questions.RemoveAll(question => question.SectionId == sectionId);
        _sections.Remove(section);
        ResequenceSections(_sections.OrderBy(item => item.Ordinal));
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReorderSections(IReadOnlyCollection<Guid> orderedSectionIds)
    {
        EnsureStructureEditable();
        ValidateCompleteOrder(
            orderedSectionIds,
            _sections.Select(section => section.Id),
            "The section order must include every section exactly once.");
        ResequenceSections(orderedSectionIds.Select(FindSection));
        UpdatedAt = DateTime.UtcNow;
    }

    public EvaluationTemplateQuestion AddQuestion(
        Guid sectionId,
        EvaluationTemplateQuestionDraft question)
    {
        EnsureStructureEditable();
        var section = FindSection(sectionId);
        if (section.Type != EvaluationSectionType.CustomQuestions)
            throw new DomainRuleViolationException("Questions can only be added to the Custom questions section.");

        var ordinal = _questions.Count(existing => existing.SectionId == sectionId) + 1;
        var created = EvaluationTemplateQuestion.Create(
            TenantId,
            Id,
            sectionId,
            ordinal,
            question.Prompt,
            question.Type,
            question.IsRequired,
            question.TargetRater,
            question.AllowNotApplicable);
        _questions.Add(created);
        UpdatedAt = DateTime.UtcNow;
        return created;
    }

    public void UpdateQuestion(Guid questionId, EvaluationTemplateQuestionDraft question)
    {
        EnsureStructureEditable();
        var existing = FindQuestion(questionId);
        existing.Update(
            existing.Ordinal,
            question.Prompt,
            question.Type,
            question.IsRequired,
            question.TargetRater,
            question.AllowNotApplicable);
        UpdatedAt = DateTime.UtcNow;
    }

    public void RemoveQuestion(Guid questionId)
    {
        EnsureStructureEditable();
        var question = FindQuestion(questionId);
        _questions.Remove(question);
        ResequenceQuestions(question.SectionId);
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReorderQuestions(Guid sectionId, IReadOnlyCollection<Guid> orderedQuestionIds)
    {
        EnsureStructureEditable();
        FindSection(sectionId);
        var sectionQuestionIds = _questions
            .Where(question => question.SectionId == sectionId)
            .Select(question => question.Id)
            .ToArray();
        ValidateCompleteOrder(
            orderedQuestionIds,
            sectionQuestionIds,
            "The question order must include every question in the section exactly once.");

        var ordinal = 1;
        foreach (var questionId in orderedQuestionIds)
            FindQuestion(questionId).SetOrdinal(ordinal++);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate()
    {
        if (Status != EvaluationConfigStatus.Draft)
            throw new DomainRuleViolationException("Only a draft evaluation template can be activated.");
        if (_sections.Count == 0)
            throw new DomainRuleViolationException("An evaluation template requires at least one section.");

        Status = EvaluationConfigStatus.Active;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Archive()
    {
        if (Status != EvaluationConfigStatus.Active)
            throw new DomainRuleViolationException("Only an active evaluation template can be archived.");

        Status = EvaluationConfigStatus.Archived;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkInUse()
    {
        if (Status != EvaluationConfigStatus.Active)
            throw new DomainRuleViolationException("Only an active evaluation template can be used by a launched round.");

        IsInUse = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public EvaluationTemplate Duplicate(string name)
    {
        var copy = CreateDraft(TenantId, name, Purpose, ParticipantInstructions);
        var sectionMap = new Dictionary<Guid, Guid>();

        foreach (var section in Sections)
        {
            var copiedSection = copy.AddSection(new EvaluationTemplateSectionDraft(
                section.Type,
                section.Title,
                section.Guidance));
            sectionMap[section.Id] = copiedSection.Id;
        }

        foreach (var question in Questions)
        {
            copy.AddQuestion(
                sectionMap[question.SectionId],
                new EvaluationTemplateQuestionDraft(
                    question.Prompt,
                    question.Type,
                    question.IsRequired,
                    question.TargetRater,
                    question.AllowNotApplicable));
        }

        return copy;
    }

    public EvaluationTemplatePreview PreviewFor(EvaluationTargetRater rater)
    {
        if (rater is not (EvaluationTargetRater.Self or EvaluationTargetRater.Manager))
            throw new ArgumentException("Preview rater must be Self or Manager.", nameof(rater));

        var sections = Sections
            .Select(section =>
            {
                var questions = Questions
                    .Where(question => question.SectionId == section.Id && IncludesRater(question.TargetRater, rater))
                    .Select(question => new EvaluationTemplateQuestionPreview(
                        question.Id,
                        question.Ordinal,
                        question.Prompt,
                        question.Type,
                        question.IsRequired,
                        question.AllowNotApplicable))
                    .ToArray();

                return new EvaluationTemplateSectionPreview(
                    section.Id,
                    section.Ordinal,
                    section.Type,
                    section.Title,
                    section.Guidance,
                    questions);
            })
            .Where(section => section.Type != EvaluationSectionType.CustomQuestions || section.Questions.Count > 0)
            .ToArray();

        return new EvaluationTemplatePreview(Id, Name, Purpose, ParticipantInstructions, rater, sections);
    }

    public void EnsureCanDelete(bool isReferenced)
    {
        if (isReferenced)
            throw new DomainRuleViolationException("A referenced evaluation template cannot be deleted.");
    }

    private static bool IncludesRater(EvaluationTargetRater target, EvaluationTargetRater rater) =>
        target == EvaluationTargetRater.Both || target == rater;

    private EvaluationTemplateSection FindSection(Guid sectionId) =>
        _sections.SingleOrDefault(section => section.Id == sectionId)
        ?? throw new DomainRuleViolationException("The section does not belong to this template.");

    private EvaluationTemplateQuestion FindQuestion(Guid questionId) =>
        _questions.SingleOrDefault(question => question.Id == questionId)
        ?? throw new DomainRuleViolationException("The question does not belong to this template.");

    private void EnsureStructureEditable()
    {
        EnsureNotArchived();
        if (IsInUse)
            throw new DomainRuleViolationException(
                "This evaluation template is in use. Duplicate it to change its structure.");
    }

    private void EnsureNotArchived()
    {
        if (Status == EvaluationConfigStatus.Archived)
            throw new DomainRuleViolationException("An archived evaluation template is read-only.");
    }

    private static void ValidateCompleteOrder(
        IReadOnlyCollection<Guid>? requestedIds,
        IEnumerable<Guid> existingIds,
        string message)
    {
        var existing = existingIds.ToArray();
        if (requestedIds is null ||
            requestedIds.Count != existing.Length ||
            requestedIds.Count != requestedIds.Distinct().Count() ||
            requestedIds.Any(id => !existing.Contains(id)))
        {
            throw new DomainRuleViolationException(message);
        }
    }

    private static void ResequenceSections(IEnumerable<EvaluationTemplateSection> sections)
    {
        var ordinal = 1;
        foreach (var section in sections)
            section.SetOrdinal(ordinal++);
    }

    private void ResequenceQuestions(Guid sectionId)
    {
        var ordinal = 1;
        foreach (var question in _questions.Where(item => item.SectionId == sectionId).OrderBy(item => item.Ordinal))
            question.SetOrdinal(ordinal++);
    }

    private static string NormalizeRequired(string value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new DomainRuleViolationException("An evaluation template requires a name.");

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

public sealed record EvaluationTemplatePreview(
    Guid TemplateId,
    string Name,
    string? Purpose,
    string? ParticipantInstructions,
    EvaluationTargetRater Rater,
    IReadOnlyList<EvaluationTemplateSectionPreview> Sections);

public sealed record EvaluationTemplateSectionPreview(
    Guid SectionId,
    int Ordinal,
    EvaluationSectionType Type,
    string Title,
    string? Guidance,
    IReadOnlyList<EvaluationTemplateQuestionPreview> Questions);

public sealed record EvaluationTemplateQuestionPreview(
    Guid QuestionId,
    int Ordinal,
    string Prompt,
    EvaluationQuestionType Type,
    bool IsRequired,
    bool AllowNotApplicable);
