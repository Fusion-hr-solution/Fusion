using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Entities.Skills;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Events;
using EY.HRPlatform.Performance.Domain.Services;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class EvaluationAssessmentTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly DateTime Start = new(2026, 1, 1, 9, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime LaunchTime = Start.AddMonths(2);
    private static readonly DateTime Now = LaunchTime.AddDays(1);

    // ---- Status machine ----

    [Fact]
    public void Submit_FromNotStarted_IsRejectedAsIllegalTransition()
    {
        var fx = LaunchSelfAndManager();
        Assert.Equal(EvaluationAssignmentStatus.NotStarted, fx.Self.Status);
        Assert.Throws<DomainRuleViolationException>(() => fx.Self.Submit(fx.Context, Now));
    }

    [Fact]
    public void Finalize_FromNotStartedManager_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        Assert.Throws<DomainRuleViolationException>(() => fx.Manager.Finalize(
            fx.Self, Summary(4, 3), 70, 30, fx.ScaleLevelCount, Now));
    }

    [Fact]
    public void Finalize_OnSelfAssignment_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        DriveToSubmitted(fx.Self, fx.Context, EvaluationAssignmentKind.SelfAssessment);
        Assert.Throws<DomainRuleViolationException>(() => fx.Self.Finalize(
            null, Summary(4, 3), 70, 30, fx.ScaleLevelCount, Now));
    }

    [Fact]
    public void FirstDraftSave_MovesNotStartedToInProgress()
    {
        var fx = LaunchSelfAndManager();
        fx.Self.SaveDraft(EvaluationAssessmentDraftInput.Empty, fx.Context, Now);
        Assert.Equal(EvaluationAssignmentStatus.InProgress, fx.Self.Status);
    }

    // ---- Draft upsert idempotency ----

    [Fact]
    public void DraftSave_IsIdempotentUpsert_PerNaturalKey()
    {
        var fx = LaunchSelfAndManager();
        var objectiveId = fx.Context.ObjectiveSnapshotIds.First();

        fx.Self.SaveDraft(ObjectiveDraft(objectiveId, 3, "first"), fx.Context, Now);
        fx.Self.SaveDraft(ObjectiveDraft(objectiveId, 5, "second"), fx.Context, Now);

        var rating = Assert.Single(fx.Self.ObjectiveRatings);
        Assert.Equal(5, rating.RatingOrdinal);
        Assert.Equal("second", rating.Comment);
    }

    // ---- Wrong-scale ordinal rejection, both directions ----

    [Fact]
    public void ObjectiveRating_OffPerformanceScale_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        var objectiveId = fx.Context.ObjectiveSnapshotIds.First();
        Assert.Throws<DomainRuleViolationException>(() =>
            fx.Self.SaveDraft(ObjectiveDraft(objectiveId, 99, null), fx.Context, Now));
    }

    [Fact]
    public void SkillRating_OffProficiencyScale_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        var skillItemId = fx.Context.SkillItemIds.First();
        var input = new EvaluationAssessmentDraftInput(
            [], [new EvaluationSkillRatingInput(skillItemId, 99, null)], []);
        Assert.Throws<DomainRuleViolationException>(() => fx.Self.SaveDraft(input, fx.Context, Now));
    }

    [Fact]
    public void Rating_ForUnknownSnapshotItem_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        Assert.Throws<DomainRuleViolationException>(() =>
            fx.Self.SaveDraft(ObjectiveDraft(Guid.NewGuid(), 3, null), fx.Context, Now));
    }

    // ---- Not-applicable rules ----

    [Fact]
    public void NotApplicable_OnQuestionThatDisallowsIt_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        var textQuestion = fx.Context.Questions.First(q => q.Type == EvaluationQuestionType.Text && !q.AllowNotApplicable);
        var input = QuestionDraft(new EvaluationQuestionAnswerInput(textQuestion.Id, null, null, true, "n/a"));
        Assert.Throws<DomainRuleViolationException>(() => fx.Self.SaveDraft(input, fx.Context, Now));
    }

    [Fact]
    public void NotApplicable_OnRequiredQuestionWithoutReason_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        var naQuestion = fx.Context.Questions.First(q => q.AllowNotApplicable && q.IsRequired);
        var input = QuestionDraft(new EvaluationQuestionAnswerInput(naQuestion.Id, null, null, true, "   "));
        Assert.Throws<DomainRuleViolationException>(() => fx.Self.SaveDraft(input, fx.Context, Now));
    }

    [Fact]
    public void NotApplicable_OnRequiredQuestionWithReason_IsAccepted()
    {
        var fx = LaunchSelfAndManager();
        var naQuestion = fx.Context.Questions.First(q => q.AllowNotApplicable && q.IsRequired);
        var input = QuestionDraft(new EvaluationQuestionAnswerInput(naQuestion.Id, null, null, true, "Not in my remit"));
        fx.Self.SaveDraft(input, fx.Context, Now);

        var answer = Assert.Single(fx.Self.QuestionAnswers);
        Assert.True(answer.IsNotApplicable);
        Assert.Equal("Not in my remit", answer.NotApplicableReason);
    }

    [Fact]
    public void Question_NotTargetedAtThisRater_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        var managerOnly = fx.Context.Questions.First(q => q.TargetRater == EvaluationTargetRater.Manager);
        var input = QuestionDraft(new EvaluationQuestionAnswerInput(managerOnly.Id, "self answering", null, false, null));
        Assert.Throws<DomainRuleViolationException>(() => fx.Self.SaveDraft(input, fx.Context, Now));
    }

    // ---- Completeness ----

    [Fact]
    public void Submit_ListsEveryIncompleteItem()
    {
        var fx = LaunchSelfAndManager();
        // Save only one objective; leave the rest, all skills, and all questions blank.
        var objectiveId = fx.Context.ObjectiveSnapshotIds.First();
        fx.Self.SaveDraft(ObjectiveDraft(objectiveId, 3, null), fx.Context, Now);

        var ex = Assert.Throws<EvaluationAssessmentIncompleteException>(() => fx.Self.Submit(fx.Context, Now));
        // The rated objective is not reported; the skill items and required self questions are.
        Assert.DoesNotContain(ex.IncompleteItems, i => i.Id == objectiveId);
        Assert.Contains(ex.IncompleteItems, i => i.Kind == EvaluationAssessmentItemKind.Skill);
        Assert.Contains(ex.IncompleteItems, i => i.Kind == EvaluationAssessmentItemKind.Question);
        Assert.Equal(EvaluationAssignmentStatus.InProgress, fx.Self.Status);
    }

    [Fact]
    public void CompleteSelfSubmit_TransitionsToSubmitted_AndRaisesEvent()
    {
        var fx = LaunchSelfAndManager();
        DriveToSubmitted(fx.Self, fx.Context, EvaluationAssignmentKind.SelfAssessment);

        Assert.Equal(EvaluationAssignmentStatus.Submitted, fx.Self.Status);
        Assert.NotNull(fx.Self.SubmittedAt);
        Assert.Contains(fx.Self.DomainEvents, e => e is EvaluationSelfAssessmentSubmittedEvent);
    }

    // ---- Immutability ----

    [Fact]
    public void SelfDraftSave_AfterSubmit_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        DriveToSubmitted(fx.Self, fx.Context, EvaluationAssignmentKind.SelfAssessment);
        var objectiveId = fx.Context.ObjectiveSnapshotIds.First();
        Assert.Throws<DomainRuleViolationException>(() =>
            fx.Self.SaveDraft(ObjectiveDraft(objectiveId, 2, null), fx.Context, Now));
    }

    [Fact]
    public void ManagerDraftSave_AfterSubmit_IsAccepted_AndStaysSubmitted()
    {
        var fx = LaunchSelfAndManager();
        DriveToSubmitted(fx.Manager, fx.Context, EvaluationAssignmentKind.ManagerAssessment);
        var objectiveId = fx.Context.ObjectiveSnapshotIds.First();

        fx.Manager.SaveDraft(ObjectiveDraft(objectiveId, 5, "revised"), fx.Context, Now);

        Assert.Equal(EvaluationAssignmentStatus.Submitted, fx.Manager.Status);
        Assert.Equal(5, fx.Manager.ObjectiveRatings.Single(r => r.ObjectiveSnapshotId == objectiveId).RatingOrdinal);
    }

    [Fact]
    public void AnyDraftSave_AfterFinalize_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        DriveToFinalized(fx);
        var objectiveId = fx.Context.ObjectiveSnapshotIds.First();
        Assert.Throws<DomainRuleViolationException>(() =>
            fx.Manager.SaveDraft(ObjectiveDraft(objectiveId, 1, null), fx.Context, Now));
    }

    // ---- D9 weighted result ----

    [Fact]
    public void Finalize_70_30_ComputesWeightedScoreAndOrdinal()
    {
        var fx = LaunchSelfAndManager();
        DriveToSubmitted(fx.Manager, fx.Context, EvaluationAssignmentKind.ManagerAssessment);

        fx.Manager.Finalize(fx.Self, Summary(4, 3), 70, 30, fx.ScaleLevelCount, Now);

        Assert.Equal(3.7m, fx.Manager.FinalScore);
        Assert.Equal(4, fx.Manager.FinalRatingOrdinal);
        Assert.Equal(EvaluationAssignmentStatus.Finalized, fx.Manager.Status);
        Assert.Equal(EvaluationAssignmentStatus.Finalized, fx.Self.Status);
        Assert.Contains(fx.Manager.DomainEvents, e => e is EvaluationFinalizedEvent);
    }

    [Fact]
    public void Finalize_RoundsHalfUp_3_65_To_3_7()
    {
        var fx = LaunchSelfAndManager();
        DriveToSubmitted(fx.Manager, fx.Context, EvaluationAssignmentKind.ManagerAssessment);

        // (4*65 + 3*35) / 100 = 3.65 -> 3.7 (half up), ordinal round(3.7) = 4
        fx.Manager.Finalize(fx.Self, Summary(4, 3), 65, 35, fx.ScaleLevelCount, Now);

        Assert.Equal(3.7m, fx.Manager.FinalScore);
        Assert.Equal(4, fx.Manager.FinalRatingOrdinal);
    }

    [Fact]
    public void Finalize_100_0_SkipsSkillsRating()
    {
        var fx = LaunchSelfAndManager();
        DriveToSubmitted(fx.Manager, fx.Context, EvaluationAssignmentKind.ManagerAssessment);

        // Skills rating omitted entirely; weight 0 makes it neither required nor scored.
        fx.Manager.Finalize(fx.Self, Summary(4, null), 100, 0, fx.ScaleLevelCount, Now);

        Assert.Equal(4.0m, fx.Manager.FinalScore);
        Assert.Equal(4, fx.Manager.FinalRatingOrdinal);
        Assert.Null(fx.Manager.OverallSkillsRatingOrdinal);
    }

    [Fact]
    public void Finalize_WithSkillsWeight_RequiresSkillsRating()
    {
        var fx = LaunchSelfAndManager();
        DriveToSubmitted(fx.Manager, fx.Context, EvaluationAssignmentKind.ManagerAssessment);
        Assert.Throws<DomainRuleViolationException>(() =>
            fx.Manager.Finalize(fx.Self, Summary(4, null), 70, 30, fx.ScaleLevelCount, Now));
    }

    [Fact]
    public void Finalize_WithoutSummary_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        DriveToSubmitted(fx.Manager, fx.Context, EvaluationAssignmentKind.ManagerAssessment);
        Assert.Throws<DomainRuleViolationException>(() => fx.Manager.Finalize(
            fx.Self,
            new EvaluationFinalizationInput(4, 3, "   "),
            70, 30, fx.ScaleLevelCount, Now));
    }

    [Fact]
    public void Finalize_Twice_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        DriveToFinalized(fx);
        Assert.Throws<DomainRuleViolationException>(() =>
            fx.Manager.Finalize(fx.Self, Summary(4, 3), 70, 30, fx.ScaleLevelCount, Now));
    }

    // ---- Reopen matrix ----

    [Fact]
    public void ReopenSelf_OnSubmittedSelf_ReturnsToInProgress_AndPreservesContent()
    {
        var fx = LaunchSelfAndManager();
        DriveToSubmitted(fx.Self, fx.Context, EvaluationAssignmentKind.SelfAssessment);
        var ratingsBefore = fx.Self.ObjectiveRatings.Count;

        fx.Self.ReopenSelf("Please revisit objective two.", Now);

        Assert.Equal(EvaluationAssignmentStatus.InProgress, fx.Self.Status);
        Assert.Null(fx.Self.SubmittedAt);
        Assert.Equal(ratingsBefore, fx.Self.ObjectiveRatings.Count);
        Assert.Contains(fx.Self.DomainEvents, e => e is EvaluationSelfAssessmentReopenedEvent);
    }

    [Fact]
    public void ReopenSelf_WithoutReason_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        DriveToSubmitted(fx.Self, fx.Context, EvaluationAssignmentKind.SelfAssessment);
        Assert.Throws<DomainRuleViolationException>(() => fx.Self.ReopenSelf("  ", Now));
    }

    [Fact]
    public void Reopen_OnManagerAssignment_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        DriveToSubmitted(fx.Manager, fx.Context, EvaluationAssignmentKind.ManagerAssessment);
        Assert.Throws<DomainRuleViolationException>(() => fx.Manager.ReopenSelf("nope", Now));
    }

    [Fact]
    public void Reopen_OnInProgressSelf_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        fx.Self.SaveDraft(EvaluationAssessmentDraftInput.Empty, fx.Context, Now);
        Assert.Throws<DomainRuleViolationException>(() => fx.Self.ReopenSelf("too early", Now));
    }

    [Fact]
    public void Reopen_AfterFinalization_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        DriveToFinalized(fx);
        Assert.Throws<DomainRuleViolationException>(() => fx.Self.ReopenSelf("too late", Now));
    }

    // ---- Acknowledgement ----

    [Fact]
    public void Acknowledge_OnFinalized_RecordsOnce()
    {
        var fx = LaunchSelfAndManager();
        DriveToFinalized(fx);

        fx.Manager.Acknowledge("Understood, thank you.", Now);

        Assert.NotNull(fx.Manager.AcknowledgedAt);
        Assert.Equal("Understood, thank you.", fx.Manager.AcknowledgementComment);
        Assert.Contains(fx.Manager.DomainEvents, e => e is EvaluationAcknowledgedEvent);

        Assert.Throws<DomainRuleViolationException>(() => fx.Manager.Acknowledge("again", Now));
    }

    [Fact]
    public void Acknowledge_BeforeFinalization_IsRejected()
    {
        var fx = LaunchSelfAndManager();
        DriveToSubmitted(fx.Manager, fx.Context, EvaluationAssignmentKind.ManagerAssessment);
        Assert.Throws<DomainRuleViolationException>(() => fx.Manager.Acknowledge(null, Now));
    }

    // ---- Actionability (3.3) ----

    [Fact]
    public void Actionability_ManagerOnlyRound_IsActionableImmediately()
    {
        Assert.True(EvaluationActionability.IsManagerActionable(
            EvaluationAssessmentModel.ManagerOnly, selfStatus: null, selfDeadline: null, Now));
    }

    [Fact]
    public void Actionability_SelfSubmitted_IsActionable()
    {
        Assert.True(EvaluationActionability.IsManagerActionable(
            EvaluationAssessmentModel.SelfAndManager,
            EvaluationAssignmentStatus.Submitted,
            Now.AddDays(5),
            Now));
    }

    [Fact]
    public void Actionability_SelfInProgressBeforeDeadline_IsNotActionable()
    {
        Assert.False(EvaluationActionability.IsManagerActionable(
            EvaluationAssessmentModel.SelfAndManager,
            EvaluationAssignmentStatus.InProgress,
            Now.AddDays(5),
            Now));
    }

    [Fact]
    public void Actionability_SelfDeadlinePassed_UnblocksAndMarksMissing()
    {
        var deadline = Now.AddDays(-1);
        Assert.True(EvaluationActionability.IsManagerActionable(
            EvaluationAssessmentModel.SelfAndManager,
            EvaluationAssignmentStatus.InProgress,
            deadline,
            Now));
        Assert.True(EvaluationActionability.SelfAssessmentMissing(
            EvaluationAssignmentStatus.InProgress, deadline, Now));
    }

    [Fact]
    public void Actionability_SelfSubmitted_IsNotMarkedMissing()
    {
        Assert.False(EvaluationActionability.SelfAssessmentMissing(
            EvaluationAssignmentStatus.Submitted, Now.AddDays(-1), Now));
    }

    // ---- Fixture ----

    private static EvaluationFinalizationInput Summary(int? objectives, int? skills) =>
        new(objectives, skills, "Solid year overall; keep raising delivery quality.");

    private static EvaluationAssessmentDraftInput ObjectiveDraft(Guid objectiveId, int? ordinal, string? comment) =>
        new([new EvaluationObjectiveRatingInput(objectiveId, ordinal, comment)], [], []);

    private static EvaluationAssessmentDraftInput QuestionDraft(EvaluationQuestionAnswerInput answer) =>
        new([], [], [answer]);

    private static void DriveToSubmitted(
        EvaluationAssignment assignment,
        EvaluationAssessmentSnapshot context,
        EvaluationAssignmentKind kind)
    {
        assignment.SaveDraft(BuildCompleteInput(context, kind), context, Now);
        assignment.Submit(context, Now);
    }

    private static void DriveToFinalized(Fixture fx)
    {
        DriveToSubmitted(fx.Self, fx.Context, EvaluationAssignmentKind.SelfAssessment);
        DriveToSubmitted(fx.Manager, fx.Context, EvaluationAssignmentKind.ManagerAssessment);
        fx.Manager.Finalize(fx.Self, Summary(4, 3), 70, 30, fx.ScaleLevelCount, Now);
    }

    private static EvaluationAssessmentDraftInput BuildCompleteInput(
        EvaluationAssessmentSnapshot context,
        EvaluationAssignmentKind kind)
    {
        var objectives = context.ObjectiveSnapshotIds
            .Select(id => new EvaluationObjectiveRatingInput(id, 3, null))
            .ToArray();
        var skills = context.SkillItemIds
            .Select(id => new EvaluationSkillRatingInput(id, 2, null))
            .ToArray();
        var questions = context.Questions
            .Where(q => q.TargetRater == EvaluationTargetRater.Both ||
                        (kind == EvaluationAssignmentKind.SelfAssessment && q.TargetRater == EvaluationTargetRater.Self) ||
                        (kind == EvaluationAssignmentKind.ManagerAssessment && q.TargetRater == EvaluationTargetRater.Manager))
            .Select(q => q.Type == EvaluationQuestionType.Text
                ? new EvaluationQuestionAnswerInput(q.Id, "Answered.", null, false, null)
                : new EvaluationQuestionAnswerInput(q.Id, null, 3, false, null))
            .ToArray();
        return new EvaluationAssessmentDraftInput(objectives, skills, questions);
    }

    private static Fixture LaunchSelfAndManager()
    {
        var employeeId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();

        var campaign = CreateLaunchedLockedCampaign(employeeId, reviewerId, out var participant, out var plan);
        var scale = CreateScale(5);
        var template = CreateTemplate();
        var (proficiency, set, skills, sources) = BuildSkills();

        var round = EvaluationRound.CreateDraft(
            TenantId, campaign, "FY2026 year-end evaluation", null,
            EvaluationRoundType.MidCycle, EvaluationAssessmentModel.SelfAndManager);
        round.SelectRatingScale(scale);
        round.SelectTemplate(template);
        round.SelectExpectationSet(set, proficiency, sources);
        round.SetWeights(70, 30);
        round.SetDeadlines(LaunchTime.AddDays(7), LaunchTime.AddDays(14), LaunchTime.AddDays(21));

        var candidate = new EvaluationRoundLaunchCandidate(participant, reviewerId, "Mia Manager", plan);
        var result = round.Launch(campaign, scale, template, set, proficiency, skills, [candidate], LaunchTime);

        var self = result.Assignments.Single(a => a.Kind == EvaluationAssignmentKind.SelfAssessment);
        var manager = result.Assignments.Single(a => a.Kind == EvaluationAssignmentKind.ManagerAssessment);
        var context = BuildContext(round, employeeId);
        return new Fixture(round, self, manager, context, scale.Levels.Count);
    }

    private static EvaluationAssessmentSnapshot BuildContext(EvaluationRound round, Guid employeeId)
    {
        var objectiveIds = round.ObjectivePlanSnapshots
            .Single(s => s.ParticipantEmployeeId == employeeId)
            .Objectives.Select(o => o.Id).ToArray();
        var skillItemIds = round.SkillSnapshot?.Items.Select(i => i.Id).ToArray() ?? [];
        var questions = round.TemplateSnapshot!.Questions
            .Select(q => new EvaluationAssessmentQuestion(q.Id, q.Type, q.IsRequired, q.TargetRater, q.AllowNotApplicable))
            .ToArray();
        var perfOrdinals = round.ScaleSnapshot!.Levels.Select(l => l.Ordinal).ToArray();
        var profOrdinals = round.SkillSnapshot?.Levels.Select(l => l.Ordinal).ToArray() ?? [];
        return new EvaluationAssessmentSnapshot(
            round.IncludesObjectives, round.IncludesSkills,
            objectiveIds, skillItemIds, questions, perfOrdinals, profOrdinals);
    }

    private static PerformanceCycle CreateLaunchedLockedCampaign(
        Guid employeeId,
        Guid reviewerId,
        out PerformanceCycleParticipant participant,
        out EmployeeObjectivePlan plan)
    {
        var snapshot = CampaignPlanningRulesSnapshot.Capture(
            5, "[25,50,75,100]", "Quantitative,Qualitative", Guid.NewGuid(), Start);
        var campaign = PerformanceCycle.CreateDraft(
            TenantId, "FY26 campaign", $"fy26-{Guid.NewGuid():N}", 2026, "Performance planning",
            Guid.NewGuid(), "HR", Start, Start.AddDays(14), Start.AddDays(21), Start.AddDays(30), snapshot);
        var strategic = campaign.AddStrategicObjective("Client impact", null, null);
        campaign.Launch(
            [new ResolvedLaunchParticipant(employeeId, "Employee", reviewerId, "Mia Manager", false, null)],
            Start.AddDays(1));

        participant = campaign.Participants.Single(p => p.EmployeeId == employeeId);
        plan = EmployeeObjectivePlan.CreateDraft(campaign, participant, Start.AddDays(2));
        plan.AddObjective(
            campaign, "Improve delivery quality", ObjectiveAlignmentType.StrategicObjective,
            strategic.Id, strategic.Title, 100, Start.AddDays(10),
            "Quantitative", "NPS", "60", "%", Start.AddDays(2));
        plan.Submit(campaign, participant, Start.AddDays(3));
        plan.Approve(
            new EmployeeObjectivePlanReviewActor(participant.ApproverEmployeeId, participant.ApproverName),
            Start.AddDays(4), "Ready for evaluation.");
        campaign.LockPlanning(Guid.NewGuid(), "HR", Start.AddDays(31));
        return campaign;
    }

    private static EvaluationRatingScale CreateScale(int levelCount)
    {
        var labels = Enumerable.Range(1, levelCount)
            .Select(n => new EvaluationRatingScaleLevelDraft($"Level {n}"))
            .ToArray();
        var scale = EvaluationRatingScale.CreateDraft(TenantId, $"{levelCount}-level scale", null, labels);
        scale.Activate();
        return scale;
    }

    private static EvaluationTemplate CreateTemplate()
    {
        var template = EvaluationTemplate.CreateDraft(TenantId, "Annual template");
        template.AddSection(new EvaluationTemplateSectionDraft(EvaluationSectionType.Objectives, "Objectives"));
        template.AddSection(new EvaluationTemplateSectionDraft(EvaluationSectionType.Skills, "Skills"));
        var questions = template.AddSection(new EvaluationTemplateSectionDraft(EvaluationSectionType.CustomQuestions, "Reflection"));
        template.AddQuestion(questions.Id, new EvaluationTemplateQuestionDraft(
            "What went well?", EvaluationQuestionType.Text, true, EvaluationTargetRater.Both, false));
        template.AddQuestion(questions.Id, new EvaluationTemplateQuestionDraft(
            "Rate collaboration.", EvaluationQuestionType.Rating, true, EvaluationTargetRater.Both, true));
        template.AddQuestion(questions.Id, new EvaluationTemplateQuestionDraft(
            "Manager-only note.", EvaluationQuestionType.Text, true, EvaluationTargetRater.Manager, false));
        template.AddSection(new EvaluationTemplateSectionDraft(EvaluationSectionType.OverallComments, "Overall comments"));
        template.Activate();
        return template;
    }

    private static (ProficiencyScale Scale, SkillExpectationSet Set, List<Skill> Skills, List<EvaluationRoundSkillSource> Sources) BuildSkills(int itemCount = 2)
    {
        var proficiency = ProficiencyScale.CreateDraft(
            TenantId, "Proficiency", null,
            [new("Foundational"), new("Proficient"), new("Expert")]);
        proficiency.Activate();

        var category = SkillCategory.Create(TenantId, "Technical");
        var skills = new List<Skill>();
        var sources = new List<EvaluationRoundSkillSource>();
        var set = SkillExpectationSet.CreateDraft(TenantId, "Core capabilities", null, proficiency.Id);
        for (var index = 0; index < itemCount; index++)
        {
            var skill = Skill.Create(TenantId, $"Skill {index + 1}", null, category.Id);
            skills.Add(skill);
            sources.Add(new EvaluationRoundSkillSource(skill.Id, skill.Name, category.Name));
            set.AddItem(skill.Id, 2, proficiency);
        }
        set.Activate(proficiency);
        return (proficiency, set, skills, sources);
    }

    private sealed record Fixture(
        EvaluationRound Round,
        EvaluationAssignment Self,
        EvaluationAssignment Manager,
        EvaluationAssessmentSnapshot Context,
        int ScaleLevelCount);
}
