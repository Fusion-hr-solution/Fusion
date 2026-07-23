using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Events;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A formal evaluation conducted inside one Performance campaign. The aggregate owns draft
/// configuration copies and freezes them, population, reviewer relationships, objectives,
/// deadlines, and the product visibility policy in one manual launch transition.
/// </summary>
public sealed class EvaluationRound : AggregateRoot, ITenantEntity
{
    public const int NameMaxLength = 160;
    public const int PurposeMaxLength = 1000;

    private readonly List<EvaluationRoundScaleDraftLevel> _draftScaleLevels = new();
    private readonly List<EvaluationRoundTemplateDraftSection> _draftTemplateSections = new();
    private readonly List<EvaluationRoundTemplateDraftQuestion> _draftTemplateQuestions = new();
    private readonly List<EvaluationRoundExclusion> _exclusions = new();
    private readonly List<EvaluationRoundReviewerCorrection> _reviewerCorrections = new();
    private readonly List<EvaluationRoundParticipant> _participants = new();
    private readonly List<EvaluationObjectivePlanSnapshot> _objectivePlanSnapshots = new();
    private readonly List<EvaluationRoundDeadlineExtension> _deadlineExtensions = new();

    private EvaluationRound() { }

    public Guid TenantId { get; private set; }
    public Guid PerformanceCycleId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Purpose { get; private set; }
    public EvaluationRoundType Type { get; private set; }
    public EvaluationAssessmentModel AssessmentModel { get; private set; }
    public EvaluationRoundStatus Status { get; private set; }
    public DateTime? SelfAssessmentDeadline { get; private set; }
    public DateTime? ManagerAssessmentDeadline { get; private set; }
    public DateTime? FinalizationDeadline { get; private set; }
    public DateTime? LaunchedAt { get; private set; }
    public uint Version { get; private set; }

    public Guid? SourceRatingScaleId { get; private set; }
    public string? DraftRatingScaleName { get; private set; }
    public string? DraftRatingScaleDescription { get; private set; }
    public Guid? SourceTemplateId { get; private set; }
    public string? DraftTemplateName { get; private set; }
    public string? DraftTemplatePurpose { get; private set; }
    public string? DraftTemplateInstructions { get; private set; }

    public EvaluationRoundScaleSnapshot? ScaleSnapshot { get; private set; }
    public EvaluationRoundTemplateSnapshot? TemplateSnapshot { get; private set; }
    public EvaluationRoundPolicySnapshot? PolicySnapshot { get; private set; }

    public IReadOnlyCollection<EvaluationRoundScaleDraftLevel> DraftScaleLevels =>
        _draftScaleLevels.OrderBy(level => level.Ordinal).ToArray();
    public IReadOnlyCollection<EvaluationRoundTemplateDraftSection> DraftTemplateSections =>
        _draftTemplateSections.OrderBy(section => section.Ordinal).ToArray();
    public IReadOnlyCollection<EvaluationRoundTemplateDraftQuestion> DraftTemplateQuestions =>
        _draftTemplateQuestions.OrderBy(question => question.Ordinal).ToArray();
    public IReadOnlyCollection<EvaluationRoundExclusion> Exclusions => _exclusions.AsReadOnly();
    public IReadOnlyCollection<EvaluationRoundReviewerCorrection> ReviewerCorrections => _reviewerCorrections.AsReadOnly();
    public IReadOnlyCollection<EvaluationRoundParticipant> Participants => _participants.AsReadOnly();
    public IReadOnlyCollection<EvaluationObjectivePlanSnapshot> ObjectivePlanSnapshots => _objectivePlanSnapshots.AsReadOnly();
    public IReadOnlyCollection<EvaluationRoundDeadlineExtension> DeadlineExtensions => _deadlineExtensions.AsReadOnly();

    public bool IncludesObjectives =>
        _draftTemplateSections.Any(section => section.Type == EvaluationSectionType.Objectives);

    public static EvaluationRound CreateDraft(
        Guid tenantId,
        PerformanceCycle campaign,
        string name,
        string? purpose,
        EvaluationRoundType type,
        EvaluationAssessmentModel assessmentModel)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant is required.", nameof(tenantId));
        EnsureCampaignLink(tenantId, campaign);
        if (campaign.Status != PerformanceCycleStatus.Launched)
            throw new DomainRuleViolationException("An evaluation round must belong to a launched performance campaign.");

        ValidateEnum(type, nameof(type));
        ValidateEnum(assessmentModel, nameof(assessmentModel));

        var round = new EvaluationRound
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PerformanceCycleId = campaign.Id,
            Status = EvaluationRoundStatus.Draft
        };
        round.UpdateConfiguration(name, purpose, type, assessmentModel);
        return round;
    }

    public void UpdateConfiguration(
        string name,
        string? purpose,
        EvaluationRoundType type,
        EvaluationAssessmentModel assessmentModel)
    {
        EnsureDraft();
        ValidateEnum(type, nameof(type));
        ValidateEnum(assessmentModel, nameof(assessmentModel));

        Name = NormalizeRequired(name, nameof(name), NameMaxLength);
        Purpose = NormalizeOptional(purpose, nameof(purpose), PurposeMaxLength);
        Type = type;
        AssessmentModel = assessmentModel;
        if (assessmentModel == EvaluationAssessmentModel.ManagerOnly)
            SelfAssessmentDeadline = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetDeadlines(
        DateTime? selfAssessmentDeadline,
        DateTime managerAssessmentDeadline,
        DateTime finalizationDeadline)
    {
        EnsureDraft();
        DateTime? self = selfAssessmentDeadline is null
            ? null
            : NormalizeUtc(selfAssessmentDeadline.Value, nameof(selfAssessmentDeadline));
        var manager = NormalizeUtc(managerAssessmentDeadline, nameof(managerAssessmentDeadline));
        var finalization = NormalizeUtc(finalizationDeadline, nameof(finalizationDeadline));
        ValidateDeadlines(AssessmentModel, self, manager, finalization);

        SelfAssessmentDeadline = self;
        ManagerAssessmentDeadline = manager;
        FinalizationDeadline = finalization;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SelectRatingScale(EvaluationRatingScale scale)
    {
        EnsureDraft();
        if (scale.TenantId != TenantId)
            throw new DomainRuleViolationException("The rating scale must belong to the round's tenant.");
        if (scale.Status != EvaluationConfigStatus.Active)
            throw new DomainRuleViolationException("Only an active rating scale can be selected.");

        SourceRatingScaleId = scale.Id;
        DraftRatingScaleName = scale.Name;
        DraftRatingScaleDescription = scale.Description;
        _draftScaleLevels.Clear();
        _draftScaleLevels.AddRange(scale.Levels.Select(level =>
            EvaluationRoundScaleDraftLevel.Copy(TenantId, Id, level)));
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateDraftScaleLevel(
        Guid draftLevelId,
        string label,
        string? description,
        string? behavioralGuidance)
    {
        EnsureDraft();
        FindDraftScaleLevel(draftLevelId).Update(label, description, behavioralGuidance);
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReorderDraftScaleLevels(IReadOnlyCollection<Guid> orderedLevelIds)
    {
        EnsureDraft();
        ValidateCompleteOrder(orderedLevelIds, _draftScaleLevels.Select(level => level.Id),
            "The round scale order must include every level exactly once.");
        var ordinal = 1;
        foreach (var levelId in orderedLevelIds)
            FindDraftScaleLevel(levelId).SetOrdinal(ordinal++);
        UpdatedAt = DateTime.UtcNow;
    }

    public void SelectTemplate(EvaluationTemplate template)
    {
        EnsureDraft();
        if (template.TenantId != TenantId)
            throw new DomainRuleViolationException("The evaluation template must belong to the round's tenant.");
        if (template.Status != EvaluationConfigStatus.Active)
            throw new DomainRuleViolationException("Only an active evaluation template can be selected.");

        SourceTemplateId = template.Id;
        DraftTemplateName = template.Name;
        DraftTemplatePurpose = template.Purpose;
        DraftTemplateInstructions = template.ParticipantInstructions;
        _draftTemplateSections.Clear();
        _draftTemplateQuestions.Clear();

        var sectionMap = new Dictionary<Guid, Guid>();
        foreach (var sourceSection in template.Sections)
        {
            var copied = EvaluationRoundTemplateDraftSection.Copy(TenantId, Id, sourceSection);
            _draftTemplateSections.Add(copied);
            sectionMap[sourceSection.Id] = copied.Id;
        }
        _draftTemplateQuestions.AddRange(template.Questions.Select(question =>
            EvaluationRoundTemplateDraftQuestion.Copy(
                TenantId,
                Id,
                sectionMap[question.SectionId],
                question)));
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateDraftTemplateSection(Guid draftSectionId, string title, string? guidance)
    {
        EnsureDraft();
        FindDraftTemplateSection(draftSectionId).Update(title, guidance);
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateDraftTemplateQuestion(Guid draftQuestionId, EvaluationTemplateQuestionDraft question)
    {
        EnsureDraft();
        FindDraftTemplateQuestion(draftQuestionId).Update(question);
        UpdatedAt = DateTime.UtcNow;
    }

    public void ExcludeParticipant(PerformanceCycleParticipant participant, string reason)
    {
        EnsureDraft();
        EnsureCampaignParticipant(participant);
        if (_exclusions.Any(item => item.ParticipantEmployeeId == participant.EmployeeId))
            throw new DomainRuleViolationException("The participant is already excluded from this round.");

        _exclusions.Add(EvaluationRoundExclusion.Create(
            TenantId,
            Id,
            participant.EmployeeId,
            participant.FullName,
            reason));
        UpdatedAt = DateTime.UtcNow;
    }

    public void IncludeParticipant(Guid participantEmployeeId)
    {
        EnsureDraft();
        var exclusion = _exclusions.SingleOrDefault(item => item.ParticipantEmployeeId == participantEmployeeId)
            ?? throw new DomainRuleViolationException("The participant is not excluded from this round.");
        _exclusions.Remove(exclusion);
        UpdatedAt = DateTime.UtcNow;
    }

    public void CorrectReviewer(
        PerformanceCycleParticipant participant,
        Guid? currentEffectiveReviewerEmployeeId,
        Guid reviewerEmployeeId,
        string reviewerName,
        string reason)
    {
        EnsureDraft();
        EnsureCampaignParticipant(participant);
        if (currentEffectiveReviewerEmployeeId.HasValue &&
            currentEffectiveReviewerEmployeeId != Guid.Empty &&
            currentEffectiveReviewerEmployeeId != participant.EmployeeId)
        {
            throw new DomainRuleViolationException(
                "A round reviewer correction is only allowed for a missing, invalid, or self-review assignment.");
        }

        var correction = EvaluationRoundReviewerCorrection.Create(
            TenantId,
            Id,
            participant.EmployeeId,
            reviewerEmployeeId,
            reviewerName,
            reason);
        var existing = _reviewerCorrections.SingleOrDefault(
            item => item.ParticipantEmployeeId == participant.EmployeeId);
        if (existing is not null)
            _reviewerCorrections.Remove(existing);
        _reviewerCorrections.Add(correction);
        UpdatedAt = DateTime.UtcNow;
    }

    public EvaluationRoundLaunchResult Launch(
        PerformanceCycle campaign,
        EvaluationRatingScale sourceScale,
        EvaluationTemplate sourceTemplate,
        IReadOnlyCollection<EvaluationRoundLaunchCandidate> candidates,
        DateTime occurredAt)
    {
        EnsureDraft();
        EnsureCampaignLink(TenantId, campaign);
        if (campaign.Id != PerformanceCycleId)
            throw new DomainRuleViolationException("The campaign does not belong to this evaluation round.");
        if (campaign.Status != PerformanceCycleStatus.Launched || !campaign.IsPlanningLocked)
            throw new DomainRuleViolationException("The campaign must be launched and planning-locked before evaluation launch.");
        EnsureSelectedConfigurationIsCurrent(sourceScale, sourceTemplate);
        EnsureDraftConfigurationComplete();

        var launchTime = NormalizeUtc(occurredAt, nameof(occurredAt));
        ValidateDeadlines(
            AssessmentModel,
            SelfAssessmentDeadline,
            ManagerAssessmentDeadline!.Value,
            FinalizationDeadline!.Value);
        if (FinalizationDeadline <= launchTime)
            throw new DomainRuleViolationException("Evaluation deadlines must be in the future at launch.");

        var candidateByEmployee = ValidateCandidates(campaign, candidates);
        var eligible = new List<(EvaluationRoundLaunchCandidate Candidate, Guid ReviewerId, string ReviewerName)>();
        var omitted = new List<EvaluationRoundOmittedParticipant>();

        foreach (var campaignParticipant in campaign.Participants)
        {
            if (_exclusions.Any(item => item.ParticipantEmployeeId == campaignParticipant.EmployeeId))
                continue;

            var candidate = candidateByEmployee[campaignParticipant.EmployeeId];
            if (IncludesObjectives && !HasEligibleObjectivePlan(candidate, campaign))
            {
                omitted.Add(new EvaluationRoundOmittedParticipant(
                    campaignParticipant.EmployeeId,
                    campaignParticipant.FullName,
                    "An approved objective plan from the locked campaign baseline is required."));
                continue;
            }

            var correction = _reviewerCorrections.SingleOrDefault(
                item => item.ParticipantEmployeeId == campaignParticipant.EmployeeId);
            var reviewerId = correction?.ReviewerEmployeeId ?? candidate.EffectiveReviewerEmployeeId;
            var reviewerName = correction?.ReviewerName ?? candidate.EffectiveReviewerName;
            if (reviewerId == Guid.Empty)
                throw new DomainRuleViolationException($"Participant '{campaignParticipant.FullName}' has no effective reviewer.");
            if (reviewerId == campaignParticipant.EmployeeId)
                throw new DomainRuleViolationException($"Participant '{campaignParticipant.FullName}' cannot review themselves.");

            eligible.Add((candidate, reviewerId, reviewerName));
        }

        if (eligible.Count == 0)
            throw new DomainRuleViolationException("An evaluation round requires at least one eligible participant.");

        ScaleSnapshot = EvaluationRoundScaleSnapshot.Capture(
            TenantId,
            Id,
            sourceScale.Id,
            DraftRatingScaleName!,
            DraftRatingScaleDescription,
            _draftScaleLevels);
        TemplateSnapshot = EvaluationRoundTemplateSnapshot.Capture(
            TenantId,
            Id,
            sourceTemplate.Id,
            DraftTemplateName!,
            DraftTemplatePurpose,
            DraftTemplateInstructions,
            _draftTemplateSections,
            _draftTemplateQuestions);
        PolicySnapshot = EvaluationRoundPolicySnapshot.Capture(
            TenantId,
            Id,
            AssessmentModel,
            SelfAssessmentDeadline,
            ManagerAssessmentDeadline.Value,
            FinalizationDeadline.Value);

        foreach (var item in eligible)
        {
            Guid? objectiveSnapshotId = null;
            if (IncludesObjectives)
            {
                var objectiveSnapshot = EvaluationObjectivePlanSnapshot.Capture(
                    TenantId,
                    Id,
                    item.Candidate.ApprovedObjectivePlan!);
                _objectivePlanSnapshots.Add(objectiveSnapshot);
                objectiveSnapshotId = objectiveSnapshot.Id;
            }

            _participants.Add(EvaluationRoundParticipant.Capture(
                TenantId,
                Id,
                item.Candidate,
                item.ReviewerId,
                item.ReviewerName,
                objectiveSnapshotId,
                launchTime));
        }

        sourceScale.MarkInUse();
        sourceTemplate.MarkInUse();
        Status = EvaluationRoundStatus.Launched;
        LaunchedAt = launchTime;
        UpdatedAt = DateTime.UtcNow;

        AddDomainEvent(new EvaluationRoundLaunchedEvent(
            TenantId,
            Id,
            PerformanceCycleId,
            Name,
            SelfAssessmentDeadline,
            ManagerAssessmentDeadline.Value,
            _participants.Select(item => new EvaluationRoundLaunchRecipient(
                item.EmployeeId,
                item.FullName,
                item.ReviewerEmployeeId,
                item.ReviewerName)).ToArray()));

        var assignments = EvaluationAssignment.Generate(this, _participants);
        return new EvaluationRoundLaunchResult(assignments, omitted);
    }

    public EvaluationRoundDeadlineExtension ExtendDeadline(
        EvaluationDeadlineKind deadlineKind,
        DateTime newDeadline,
        string reason,
        Guid actorUserId,
        string actorName,
        DateTime occurredAt)
    {
        if (Status != EvaluationRoundStatus.Launched)
            throw new DomainRuleViolationException("Deadlines can only be extended after the round launches.");
        ValidateEnum(deadlineKind, nameof(deadlineKind));

        var normalized = NormalizeUtc(newDeadline, nameof(newDeadline));
        var occurred = NormalizeUtc(occurredAt, nameof(occurredAt));
        var previous = deadlineKind switch
        {
            EvaluationDeadlineKind.SelfAssessment when SelfAssessmentDeadline.HasValue => SelfAssessmentDeadline.Value,
            EvaluationDeadlineKind.SelfAssessment => throw new DomainRuleViolationException(
                "A manager-only round has no self-assessment deadline."),
            EvaluationDeadlineKind.ManagerAssessment => ManagerAssessmentDeadline!.Value,
            EvaluationDeadlineKind.Finalization => FinalizationDeadline!.Value,
            _ => throw new DomainRuleViolationException("The deadline type is not supported.")
        };
        if (normalized <= previous)
            throw new DomainRuleViolationException("A deadline extension must move the deadline later.");

        var self = deadlineKind == EvaluationDeadlineKind.SelfAssessment ? normalized : SelfAssessmentDeadline;
        var manager = deadlineKind == EvaluationDeadlineKind.ManagerAssessment ? normalized : ManagerAssessmentDeadline!.Value;
        var finalization = deadlineKind == EvaluationDeadlineKind.Finalization ? normalized : FinalizationDeadline!.Value;
        ValidateDeadlines(AssessmentModel, self, manager, finalization);

        var extension = EvaluationRoundDeadlineExtension.Create(
            TenantId,
            Id,
            deadlineKind,
            previous,
            normalized,
            reason,
            actorUserId,
            actorName,
            occurred);
        _deadlineExtensions.Add(extension);

        SelfAssessmentDeadline = self;
        ManagerAssessmentDeadline = manager;
        FinalizationDeadline = finalization;
        UpdatedAt = DateTime.UtcNow;
        AddDomainEvent(new EvaluationRoundDeadlineExtendedEvent(
            TenantId,
            Id,
            PerformanceCycleId,
            Name,
            deadlineKind,
            previous,
            normalized,
            extension.Reason));
        return extension;
    }

    public EvaluationRoundOperationalState GetOperationalState(
        DateTime now,
        IReadOnlyCollection<EvaluationAssignment> assignments,
        bool readinessSatisfied = false)
    {
        if (Status == EvaluationRoundStatus.Draft)
            return readinessSatisfied ? EvaluationRoundOperationalState.ReadyToLaunch : EvaluationRoundOperationalState.Draft;

        var roundAssignments = assignments.Where(item => item.RoundId == Id).ToArray();
        if (roundAssignments.Length > 0 && roundAssignments.All(item => item.Status == EvaluationAssignmentStatus.Finalized))
            return EvaluationRoundOperationalState.Completed;

        var utcNow = NormalizeUtc(now, nameof(now));
        var hasOverdueSelf = SelfAssessmentDeadline.HasValue &&
            utcNow > SelfAssessmentDeadline.Value &&
            roundAssignments.Any(item =>
                item.Kind == EvaluationAssignmentKind.SelfAssessment &&
                item.Status is not (EvaluationAssignmentStatus.Submitted or EvaluationAssignmentStatus.Finalized));
        var hasOverdueManager = ManagerAssessmentDeadline.HasValue &&
            utcNow > ManagerAssessmentDeadline.Value &&
            roundAssignments.Any(item =>
                item.Kind == EvaluationAssignmentKind.ManagerAssessment &&
                item.Status != EvaluationAssignmentStatus.Finalized);
        return hasOverdueSelf || hasOverdueManager
            ? EvaluationRoundOperationalState.Overdue
            : EvaluationRoundOperationalState.InProgress;
    }

    private Dictionary<Guid, EvaluationRoundLaunchCandidate> ValidateCandidates(
        PerformanceCycle campaign,
        IReadOnlyCollection<EvaluationRoundLaunchCandidate>? candidates)
    {
        if (candidates is null)
            throw new ArgumentNullException(nameof(candidates));
        if (candidates.Any(candidate =>
                candidate.Participant.TenantId != TenantId ||
                candidate.Participant.CycleId != PerformanceCycleId))
        {
            throw new DomainRuleViolationException("Launch candidates must come from this campaign's frozen population.");
        }

        var duplicate = candidates.GroupBy(candidate => candidate.Participant.EmployeeId).Any(group => group.Count() > 1);
        if (duplicate)
            throw new DomainRuleViolationException("Each campaign participant can appear only once at launch.");

        var result = candidates.ToDictionary(candidate => candidate.Participant.EmployeeId);
        if (campaign.Participants.Any(participant => !result.ContainsKey(participant.EmployeeId)))
            throw new DomainRuleViolationException("Launch readiness must evaluate every frozen campaign participant.");
        return result;
    }

    private bool HasEligibleObjectivePlan(EvaluationRoundLaunchCandidate candidate, PerformanceCycle campaign)
    {
        var plan = candidate.ApprovedObjectivePlan;
        return plan is not null &&
               plan.TenantId == TenantId &&
               plan.CycleId == campaign.Id &&
               plan.EmployeeId == candidate.Participant.EmployeeId &&
               plan.Status == PlanStatus.Approved &&
               plan.ApprovedAt.HasValue &&
               campaign.IsPlanningLocked;
    }

    private void EnsureSelectedConfigurationIsCurrent(
        EvaluationRatingScale sourceScale,
        EvaluationTemplate sourceTemplate)
    {
        if (SourceRatingScaleId != sourceScale.Id ||
            sourceScale.TenantId != TenantId ||
            sourceScale.Status != EvaluationConfigStatus.Active)
        {
            throw new DomainRuleViolationException("The selected rating scale must still be active and tenant-owned.");
        }
        if (SourceTemplateId != sourceTemplate.Id ||
            sourceTemplate.TenantId != TenantId ||
            sourceTemplate.Status != EvaluationConfigStatus.Active)
        {
            throw new DomainRuleViolationException("The selected template must still be active and tenant-owned.");
        }
    }

    private void EnsureDraftConfigurationComplete()
    {
        if (!SourceRatingScaleId.HasValue || _draftScaleLevels.Count is < 3 or > 7)
            throw new DomainRuleViolationException("Select a valid rating scale before launch.");
        if (!SourceTemplateId.HasValue || _draftTemplateSections.Count == 0)
            throw new DomainRuleViolationException("Select a meaningful evaluation template before launch.");
        if (!ManagerAssessmentDeadline.HasValue || !FinalizationDeadline.HasValue)
            throw new DomainRuleViolationException("Set all required evaluation deadlines before launch.");
    }

    private EvaluationRoundScaleDraftLevel FindDraftScaleLevel(Guid levelId) =>
        _draftScaleLevels.SingleOrDefault(level => level.Id == levelId)
        ?? throw new DomainRuleViolationException("The scale level does not belong to this round.");

    private EvaluationRoundTemplateDraftSection FindDraftTemplateSection(Guid sectionId) =>
        _draftTemplateSections.SingleOrDefault(section => section.Id == sectionId)
        ?? throw new DomainRuleViolationException("The template section does not belong to this round.");

    private EvaluationRoundTemplateDraftQuestion FindDraftTemplateQuestion(Guid questionId) =>
        _draftTemplateQuestions.SingleOrDefault(question => question.Id == questionId)
        ?? throw new DomainRuleViolationException("The template question does not belong to this round.");

    private void EnsureCampaignParticipant(PerformanceCycleParticipant participant)
    {
        if (participant.TenantId != TenantId || participant.CycleId != PerformanceCycleId)
            throw new DomainRuleViolationException("The participant must belong to this round's campaign baseline.");
    }

    private void EnsureDraft()
    {
        if (Status != EvaluationRoundStatus.Draft)
            throw new DomainRuleViolationException("A launched evaluation round is read-only.");
    }

    private static void EnsureCampaignLink(Guid tenantId, PerformanceCycle campaign)
    {
        ArgumentNullException.ThrowIfNull(campaign);
        if (campaign.TenantId != tenantId)
            throw new DomainRuleViolationException("The performance campaign must belong to the same tenant.");
    }

    private static void ValidateDeadlines(
        EvaluationAssessmentModel model,
        DateTime? selfDeadline,
        DateTime managerDeadline,
        DateTime finalizationDeadline)
    {
        if (model == EvaluationAssessmentModel.SelfAndManager)
        {
            if (!selfDeadline.HasValue)
                throw new DomainRuleViolationException("A self-assessment deadline is required.");
            if (selfDeadline.Value >= managerDeadline)
                throw new DomainRuleViolationException("The self-assessment deadline must precede the manager deadline.");
        }
        else if (selfDeadline.HasValue)
        {
            throw new DomainRuleViolationException("A manager-only round cannot have a self-assessment deadline.");
        }

        if (managerDeadline >= finalizationDeadline)
            throw new DomainRuleViolationException("The manager deadline must precede the finalization deadline.");
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

    private static void ValidateEnum<T>(T value, string paramName) where T : struct, Enum
    {
        if (!Enum.IsDefined(value))
            throw new ArgumentOutOfRangeException(paramName, value, "The value is not supported.");
    }

    private static string NormalizeRequired(string value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new DomainRuleViolationException("An evaluation round requires a name.");

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

    private static DateTime NormalizeUtc(DateTime value, string paramName)
    {
        if (value == default)
            throw new ArgumentException("A valid date is required.", paramName);
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}

public sealed record EvaluationRoundLaunchResult(
    IReadOnlyList<EvaluationAssignment> Assignments,
    IReadOnlyList<EvaluationRoundOmittedParticipant> OmittedParticipants);

public sealed record EvaluationRoundOmittedParticipant(
    Guid EmployeeId,
    string EmployeeName,
    string Reason);
