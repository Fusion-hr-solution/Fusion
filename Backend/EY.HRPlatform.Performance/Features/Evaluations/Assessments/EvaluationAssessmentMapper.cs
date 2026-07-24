using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Evaluations.Assessments.Dtos;

namespace EY.HRPlatform.Performance.Features.Evaluations.Assessments;

/// <summary>
/// Read-side projections from a launched round's frozen snapshots + an assignment's responses.
/// Manager-only fields (comparison, result) are exposed by the query handlers only when the
/// visibility model permits — this mapper never decides visibility, it only shapes data.
/// </summary>
internal static class EvaluationAssessmentMapper
{
    public static IReadOnlyList<AssessmentScaleLevelDto> PerformanceScale(EvaluationRound round) =>
        round.ScaleSnapshot!.Levels
            .Select(level => new AssessmentScaleLevelDto(level.Ordinal, level.Label, level.Description))
            .ToArray();

    public static IReadOnlyList<AssessmentProficiencyLevelDto> ProficiencyScale(EvaluationRound round) =>
        round.SkillSnapshot?.Levels
            .Select(level => new AssessmentProficiencyLevelDto(level.Ordinal, level.Label, level.Description))
            .ToArray()
        ?? Array.Empty<AssessmentProficiencyLevelDto>();

    public static string? PerformanceLabel(EvaluationRound round, int? ordinal) =>
        ordinal is int o ? round.ScaleSnapshot!.Levels.FirstOrDefault(l => l.Ordinal == o)?.Label : null;

    private static string? ProficiencyLabel(EvaluationRound round, int ordinal) =>
        round.SkillSnapshot?.Levels.FirstOrDefault(l => l.Ordinal == ordinal)?.Label;

    private static IReadOnlyList<EvaluationObjectiveSnapshot> ObjectivesFor(
        EvaluationRound round, EvaluationAssignment assignment) =>
        assignment.ObjectivePlanSnapshotId is { } planId
            ? round.ObjectivePlanSnapshots.SingleOrDefault(p => p.Id == planId)?.Objectives.ToArray()
                ?? Array.Empty<EvaluationObjectiveSnapshot>()
            : Array.Empty<EvaluationObjectiveSnapshot>();

    private static bool QuestionForKind(EvaluationTargetRater rater, EvaluationAssignmentKind kind) => rater switch
    {
        EvaluationTargetRater.Both => true,
        EvaluationTargetRater.Self => kind == EvaluationAssignmentKind.SelfAssessment,
        EvaluationTargetRater.Manager => kind == EvaluationAssignmentKind.ManagerAssessment,
        _ => false
    };

    // ─── Authoring workspace (self or manager, own responses) ─────────────────

    public static AssessmentWorkspaceDto Workspace(
        EvaluationRound round,
        EvaluationAssignment assignment,
        bool editable,
        EvaluationResultDto? result,
        EvaluationAssignment? managerAssignment = null)
    {
        var objectiveRatings = assignment.ObjectiveRatings.ToDictionary(r => r.ObjectiveSnapshotId);
        var skillRatings = assignment.SkillRatings.ToDictionary(r => r.SkillSnapshotItemId);
        var showManagerContent = result is not null && managerAssignment is not null;
        var managerObjectiveRatings = managerAssignment?.ObjectiveRatings.ToDictionary(r => r.ObjectiveSnapshotId)
            ?? new Dictionary<Guid, EvaluationObjectiveRating>();
        var managerSkillRatings = managerAssignment?.SkillRatings.ToDictionary(r => r.SkillSnapshotItemId)
            ?? new Dictionary<Guid, EvaluationSkillRating>();
        var answers = assignment.QuestionAnswers.ToDictionary(a => a.QuestionSnapshotId);

        var objectives = ObjectivesFor(round, assignment).Select(obj =>
        {
            objectiveRatings.TryGetValue(obj.Id, out var rating);
            managerObjectiveRatings.TryGetValue(obj.Id, out var managerRating);
            return new AssessmentObjectiveItemDto(
                obj.Id, obj.Title, obj.Description, obj.Weight, obj.Deadline,
                obj.MeasurementIndicator, obj.TargetValue, obj.TargetUnit, obj.SuccessCriteria,
                rating?.RatingOrdinal, rating?.Comment,
                showManagerContent ? managerRating?.RatingOrdinal : null,
                showManagerContent ? managerRating?.Comment : null);
        }).ToArray();

        var skills = (round.SkillSnapshot?.Items ?? Array.Empty<EvaluationRoundSkillSnapshotItem>())
            .OrderBy(item => item.ExpectedLevelOrdinal)
            .Select(item =>
            {
                skillRatings.TryGetValue(item.Id, out var rating);
                managerSkillRatings.TryGetValue(item.Id, out var managerRating);
                return new AssessmentSkillItemDto(
                    item.Id, item.SkillId, item.SkillName, item.CategoryName,
                    item.ExpectedLevelOrdinal, ProficiencyLabel(round, item.ExpectedLevelOrdinal),
                    rating?.ProficiencyOrdinal, rating?.Comment,
                    showManagerContent ? managerRating?.ProficiencyOrdinal : null,
                    showManagerContent ? managerRating?.Comment : null);
            }).ToArray();

        var questions = round.TemplateSnapshot!.Questions
            .Where(q => QuestionForKind(q.TargetRater, assignment.Kind))
            .OrderBy(q => q.Ordinal)
            .Select(q =>
            {
                answers.TryGetValue(q.Id, out var answer);
                return new AssessmentQuestionItemDto(
                    q.Id, q.Prompt, q.Type.ToString(), q.IsRequired, q.AllowNotApplicable,
                    answer?.TextAnswer, answer?.RatingOrdinal, answer?.IsNotApplicable ?? false,
                    answer?.NotApplicableReason);
            }).ToArray();

        return new AssessmentWorkspaceDto(
            assignment.Id, round.Id, round.Name, assignment.Kind.ToString(), assignment.Status.ToString(),
            editable, assignment.ObjectivePlanSnapshotId.HasValue, assignment.SkillSnapshotId.HasValue,
            round.ObjectivesWeightPercent, round.SkillsWeightPercent, Deadline(round, assignment.Kind),
            PerformanceScale(round), ProficiencyScale(round), objectives, skills, questions, result,
            managerAssignment?.Id);
    }

    // ─── Comparison workspace (manager, self+manager side by side) ────────────

    public static ParticipantWorkspaceDto ParticipantWorkspace(
        EvaluationRound round,
        EvaluationAssignment manager,
        EvaluationAssignment? self,
        bool actionable,
        bool selfSubmitted,
        bool selfMissing,
        bool includeManagerContent,
        bool includeSelfContent,
        EvaluationResultDto? result)
    {
        var managerObjectives = manager.ObjectiveRatings.ToDictionary(r => r.ObjectiveSnapshotId);
        var selfObjectives = self?.ObjectiveRatings.ToDictionary(r => r.ObjectiveSnapshotId)
            ?? new Dictionary<Guid, EvaluationObjectiveRating>();
        var managerSkills = manager.SkillRatings.ToDictionary(r => r.SkillSnapshotItemId);
        var selfSkills = self?.SkillRatings.ToDictionary(r => r.SkillSnapshotItemId)
            ?? new Dictionary<Guid, EvaluationSkillRating>();
        var managerAnswers = manager.QuestionAnswers.ToDictionary(a => a.QuestionSnapshotId);
        var selfAnswers = self?.QuestionAnswers.ToDictionary(a => a.QuestionSnapshotId)
            ?? new Dictionary<Guid, EvaluationQuestionAnswer>();

        int? ManagerObj(Guid id) => includeManagerContent && managerObjectives.TryGetValue(id, out var r) ? r.RatingOrdinal : null;
        string? ManagerObjComment(Guid id) => includeManagerContent && managerObjectives.TryGetValue(id, out var r) ? r.Comment : null;
        int? SelfObj(Guid id) => includeSelfContent && selfObjectives.TryGetValue(id, out var r) ? r.RatingOrdinal : null;
        string? SelfObjComment(Guid id) => includeSelfContent && selfObjectives.TryGetValue(id, out var r) ? r.Comment : null;

        var objectives = ObjectivesFor(round, manager).Select(obj =>
        {
            var self0 = SelfObj(obj.Id);
            var mgr0 = ManagerObj(obj.Id);
            return new ComparisonObjectiveDto(
                obj.Id, obj.Title, obj.Description, obj.Weight,
                obj.MeasurementIndicator, obj.TargetValue, obj.TargetUnit, obj.SuccessCriteria,
                self0, SelfObjComment(obj.Id), mgr0, ManagerObjComment(obj.Id),
                EvaluationAssessmentRules.IsMaterialDifference(self0, mgr0));
        }).ToArray();

        var belowCount = 0; var meetsCount = 0; var exceedsCount = 0;
        var skills = (round.SkillSnapshot?.Items ?? Array.Empty<EvaluationRoundSkillSnapshotItem>())
            .OrderBy(item => item.ExpectedLevelOrdinal)
            .Select(item =>
            {
                var self0 = includeSelfContent && selfSkills.TryGetValue(item.Id, out var sr) ? sr.ProficiencyOrdinal : null;
                var mgr0 = includeManagerContent && managerSkills.TryGetValue(item.Id, out var mr) ? mr.ProficiencyOrdinal : null;
                var gap = mgr0 is int a ? a - item.ExpectedLevelOrdinal : (int?)null;
                var gapState = EvaluationAssessmentRules.GapState(item.ExpectedLevelOrdinal, mgr0);
                if (gapState == "Below") belowCount++;
                else if (gapState == "Exceeds") exceedsCount++;
                else if (gapState == "Meets") meetsCount++;
                return new ComparisonSkillDto(
                    item.Id, item.SkillId, item.SkillName, item.CategoryName,
                    item.ExpectedLevelOrdinal, ProficiencyLabel(round, item.ExpectedLevelOrdinal),
                    self0, includeSelfContent && selfSkills.TryGetValue(item.Id, out var sc) ? sc.Comment : null,
                    mgr0, includeManagerContent && managerSkills.TryGetValue(item.Id, out var mc) ? mc.Comment : null,
                    gap, gapState,
                    EvaluationAssessmentRules.IsMaterialDifference(self0, mgr0));
            }).ToArray();

        var questions = round.TemplateSnapshot!.Questions
            .OrderBy(q => q.Ordinal)
            .Select(q =>
            {
                selfAnswers.TryGetValue(q.Id, out var sa);
                managerAnswers.TryGetValue(q.Id, out var ma);
                var showSelf = includeSelfContent && QuestionForKind(q.TargetRater, EvaluationAssignmentKind.SelfAssessment);
                var showMgr = includeManagerContent && QuestionForKind(q.TargetRater, EvaluationAssignmentKind.ManagerAssessment);
                return new ComparisonQuestionDto(
                    q.Id, q.Prompt, q.Type.ToString(), q.TargetRater.ToString(), q.IsRequired, q.AllowNotApplicable,
                    showSelf ? sa?.TextAnswer : null, showSelf ? sa?.RatingOrdinal : null, showSelf && (sa?.IsNotApplicable ?? false),
                    showMgr ? ma?.TextAnswer : null, showMgr ? ma?.RatingOrdinal : null, showMgr && (ma?.IsNotApplicable ?? false));
            })
            .ToArray();

        decimal? meanManagerObjective = null;
        if (includeManagerContent)
        {
            var rated = objectives.Where(o => o.ManagerRatingOrdinal.HasValue).Select(o => o.ManagerRatingOrdinal!.Value).ToArray();
            if (rated.Length > 0)
                meanManagerObjective = Math.Round((decimal)rated.Average(), 1, MidpointRounding.AwayFromZero);
        }

        return new ParticipantWorkspaceDto(
            round.Id, round.Name, manager.ParticipantEmployeeId, manager.ParticipantName,
            self?.Id, manager.Id, manager.Status.ToString(), actionable, selfSubmitted, selfMissing,
            manager.ObjectivePlanSnapshotId.HasValue, manager.SkillSnapshotId.HasValue,
            round.ObjectivesWeightPercent, round.SkillsWeightPercent,
            round.ManagerAssessmentDeadline, round.FinalizationDeadline,
            PerformanceScale(round), ProficiencyScale(round),
            objectives, skills, questions,
            meanManagerObjective, belowCount, meetsCount, exceedsCount, result, manager.Version);
    }

    public static EvaluationResultDto Result(EvaluationRound round, EvaluationAssignment manager) => new(
        manager.OverallObjectivesRatingOrdinal,
        PerformanceLabel(round, manager.OverallObjectivesRatingOrdinal),
        manager.OverallSkillsRatingOrdinal,
        PerformanceLabel(round, manager.OverallSkillsRatingOrdinal),
        manager.FinalScore,
        manager.FinalRatingOrdinal,
        PerformanceLabel(round, manager.FinalRatingOrdinal),
        manager.DiscussionSummary,
        round.ObjectivesWeightPercent,
        round.SkillsWeightPercent,
        manager.FinalizedAt,
        manager.AcknowledgedAt,
        manager.AcknowledgementComment);

    public static DateTime? Deadline(EvaluationRound round, EvaluationAssignmentKind kind) => kind switch
    {
        EvaluationAssignmentKind.SelfAssessment => round.SelfAssessmentDeadline,
        EvaluationAssignmentKind.ManagerAssessment => round.ManagerAssessmentDeadline,
        _ => null
    };
}
