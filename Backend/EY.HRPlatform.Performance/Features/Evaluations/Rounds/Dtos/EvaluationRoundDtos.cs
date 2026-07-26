using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Features.Evaluations.Rounds.Dtos;

public sealed record EvaluationRoundSummaryDto(
    Guid Id, Guid CampaignId, string Name, string? Purpose, string Type,
    string AssessmentModel, string Status, string OperationalState,
    DateTime? SelfAssessmentDeadline, DateTime? ManagerAssessmentDeadline,
    DateTime? FinalizationDeadline, DateTime? LaunchedAt, uint Version);

public sealed record EvaluationRoundScaleLevelDto(
    Guid Id, int Ordinal, int Value, string Label, string? Description, string? BehavioralGuidance);

public sealed record EvaluationRoundTemplateQuestionDto(
    Guid Id, Guid SectionId, int Ordinal, string Prompt, string Type,
    bool IsRequired, string TargetRater, bool AllowNotApplicable);

public sealed record EvaluationRoundTemplateSectionDto(
    Guid Id, int Ordinal, string Type, string Title, string? Guidance,
    IReadOnlyList<EvaluationRoundTemplateQuestionDto> Questions);

public sealed record EvaluationRoundProficiencyLevelDto(
    Guid Id, int Ordinal, int Value, string Label, string? Description);

public sealed record EvaluationRoundSkillItemDto(
    Guid Id, Guid SkillId, string SkillName, string CategoryName,
    int ExpectedLevelOrdinal, string? ExpectedLevelLabel);

public sealed record EvaluationRoundSkillDto(
    Guid? SourceExpectationSetId,
    string? SetName,
    string? ScaleName,
    int ObjectivesWeightPercent,
    int SkillsWeightPercent,
    IReadOnlyList<EvaluationRoundProficiencyLevelDto> ProficiencyLevels,
    IReadOnlyList<EvaluationRoundSkillItemDto> Items);

public sealed record EvaluationRoundDetailDto(
    EvaluationRoundSummaryDto Round,
    Guid? SourceRatingScaleId,
    string? RatingScaleName,
    IReadOnlyList<EvaluationRoundScaleLevelDto> RatingScaleLevels,
    Guid? SourceTemplateId,
    string? TemplateName,
    string? TemplatePurpose,
    string? TemplateInstructions,
    IReadOnlyList<EvaluationRoundTemplateSectionDto> TemplateSections,
    IReadOnlyList<EvaluationRoundExclusionDto> Exclusions,
    IReadOnlyList<EvaluationRoundReviewerCorrectionDto> ReviewerCorrections,
    int ParticipantCount,
    int AssignmentCount,
    bool IncludesSkills,
    EvaluationRoundSkillDto Skills);

public sealed record EvaluationRoundExclusionDto(Guid EmployeeId, string EmployeeName, string Reason);
public sealed record EvaluationRoundReviewerCorrectionDto(
    Guid EmployeeId, Guid ReviewerEmployeeId, string ReviewerName, string Reason);

public sealed record EvaluationReadinessIssueDto(string Code, string Message, Guid? EmployeeId = null);

public sealed record EvaluationRoundAssignmentPreviewDto(
    Guid EmployeeId, string EmployeeName, Guid? ReviewerEmployeeId, string? ReviewerName,
    bool Included, bool HasEligibleObjectivePlan, string? OmissionReason);

public sealed record EvaluationRoundReadinessSkillsDto(
    bool IncludesSkills, bool SetSelected, string? SetName, int ItemCount,
    int ObjectivesWeightPercent, int SkillsWeightPercent);

public sealed record EvaluationRoundReadinessDto(
    Guid RoundId, bool CanLaunch, int CampaignParticipantCount, int IncludedParticipantCount,
    int OmittedParticipantCount, int ManagerAssignmentCount, int SelfAssignmentCount,
    IReadOnlyList<EvaluationReadinessIssueDto> Blockers,
    IReadOnlyList<EvaluationReadinessIssueDto> Warnings,
    IReadOnlyList<EvaluationRoundAssignmentPreviewDto> AssignmentPreview,
    EvaluationRoundReadinessSkillsDto Skills);

public sealed record EvaluationRoundLaunchDto(
    Guid RoundId, string Status, DateTime? LaunchedAt, int ParticipantCount,
    int AssignmentCount, int OmittedParticipantCount, uint Version);

public sealed record EvaluationAssignmentRosterItemDto(
    Guid Id, Guid ParticipantEmployeeId, string ParticipantName, string Kind,
    Guid AssigneeEmployeeId, string AssigneeName, string Status);

public sealed record EvaluationAssignmentRosterDto(
    Guid RoundId, int Page, int PageSize, int TotalCount,
    IReadOnlyList<EvaluationAssignmentRosterItemDto> Items);

public sealed record EvaluationWorkEntryDto(
    EvaluationRoundDetailDto Round,
    EvaluationAssignmentRosterItemDto Assignment,
    IReadOnlyList<EvaluationObjectiveSnapshotDto> ObjectiveBaseline);

public sealed record EvaluationObjectiveSnapshotDto(
    Guid Id, string Title, string? Description, int? Weight, DateTime? Deadline,
    string? MeasurementIndicator, string? TargetValue, string? TargetUnit, string? SuccessCriteria);

public static class EvaluationRoundMapper
{
    public static EvaluationRoundSummaryDto ToSummary(
        EvaluationRound round,
        IReadOnlyCollection<EvaluationAssignment>? assignments = null,
        bool ready = false) => new(
            round.Id, round.PerformanceCycleId, round.Name, round.Purpose,
            round.Type.ToString(), round.AssessmentModel.ToString(), round.Status.ToString(),
            round.GetOperationalState(DateTime.UtcNow, assignments ?? Array.Empty<EvaluationAssignment>(), ready).ToString(),
            round.SelfAssessmentDeadline, round.ManagerAssessmentDeadline,
            round.FinalizationDeadline, round.LaunchedAt, round.Version);

    public static EvaluationRoundDetailDto ToDetail(
        EvaluationRound round,
        IReadOnlyCollection<EvaluationAssignment>? assignments = null,
        bool ready = false)
    {
        var questions = round.TemplateSnapshot?.Questions.Select(q => new EvaluationRoundTemplateQuestionDto(
                q.Id, q.SectionSnapshotId, q.Ordinal, q.Prompt, q.Type.ToString(), q.IsRequired,
                q.TargetRater.ToString(), q.AllowNotApplicable)).ToArray()
            ?? round.DraftTemplateQuestions.Select(q => new EvaluationRoundTemplateQuestionDto(
                q.Id, q.DraftSectionId, q.Ordinal, q.Prompt, q.Type.ToString(), q.IsRequired,
                q.TargetRater.ToString(), q.AllowNotApplicable)).ToArray();
        var sections = round.TemplateSnapshot?.Sections.Select(s => new EvaluationRoundTemplateSectionDto(
                s.Id, s.Ordinal, s.Type.ToString(), s.Title, s.Guidance,
                questions.Where(q => q.SectionId == s.Id).OrderBy(q => q.Ordinal).ToArray())).ToArray()
            ?? round.DraftTemplateSections.Select(s => new EvaluationRoundTemplateSectionDto(
                s.Id, s.Ordinal, s.Type.ToString(), s.Title, s.Guidance,
                questions.Where(q => q.SectionId == s.Id).OrderBy(q => q.Ordinal).ToArray())).ToArray();
        var levels = round.ScaleSnapshot?.Levels.Select(l => new EvaluationRoundScaleLevelDto(
                l.Id, l.Ordinal, l.Value, l.Label, l.Description, l.BehavioralGuidance)).ToArray()
            ?? round.DraftScaleLevels.Select(l => new EvaluationRoundScaleLevelDto(
                l.Id, l.Ordinal, l.Value, l.Label, l.Description, l.BehavioralGuidance)).ToArray();

        var skills = BuildSkills(round);

        return new EvaluationRoundDetailDto(
            ToSummary(round, assignments, ready), round.SourceRatingScaleId,
            round.ScaleSnapshot?.Name ?? round.DraftRatingScaleName, levels,
            round.SourceTemplateId, round.TemplateSnapshot?.Name ?? round.DraftTemplateName,
            round.TemplateSnapshot?.Purpose ?? round.DraftTemplatePurpose,
            round.TemplateSnapshot?.ParticipantInstructions ?? round.DraftTemplateInstructions,
            sections,
            round.Exclusions.Select(x => new EvaluationRoundExclusionDto(x.ParticipantEmployeeId, x.ParticipantName, x.Reason)).ToArray(),
            round.ReviewerCorrections.Select(x => new EvaluationRoundReviewerCorrectionDto(
                x.ParticipantEmployeeId, x.ReviewerEmployeeId, x.ReviewerName, x.Reason)).ToArray(),
            round.Participants.Count,
            assignments?.Count ?? 0,
            round.IncludesSkills || round.SkillSnapshot is not null,
            skills);
    }

    // Skills draft copy (draft round) or frozen skill snapshot (launched round). Objective-only
    // rounds carry the 100/0 default and empty collections, so pre-change launched rounds read clean.
    private static EvaluationRoundSkillDto BuildSkills(EvaluationRound round)
    {
        if (round.SkillSnapshot is { } snapshot)
        {
            var labelByOrdinal = snapshot.Levels.ToDictionary(level => level.Ordinal, level => level.Label);
            return new EvaluationRoundSkillDto(
                snapshot.SourceExpectationSetId,
                snapshot.SetName,
                snapshot.ProficiencyScaleName,
                round.ObjectivesWeightPercent,
                round.SkillsWeightPercent,
                snapshot.Levels.Select(level => new EvaluationRoundProficiencyLevelDto(
                    level.Id, level.Ordinal, level.Value, level.Label, level.Description)).ToArray(),
                snapshot.Items
                    .OrderBy(item => item.ExpectedLevelOrdinal)
                    .Select(item => new EvaluationRoundSkillItemDto(
                        item.Id, item.SkillId, item.SkillName, item.CategoryName,
                        item.ExpectedLevelOrdinal,
                        labelByOrdinal.GetValueOrDefault(item.ExpectedLevelOrdinal))).ToArray());
        }

        var draftLabelByOrdinal = round.DraftProficiencyLevels.ToDictionary(level => level.Ordinal, level => level.Label);
        return new EvaluationRoundSkillDto(
            round.SourceExpectationSetId,
            round.DraftSkillSetName,
            round.DraftSkillScaleName,
            round.ObjectivesWeightPercent,
            round.SkillsWeightPercent,
            round.DraftProficiencyLevels.Select(level => new EvaluationRoundProficiencyLevelDto(
                level.Id, level.Ordinal, level.Value, level.Label, level.Description)).ToArray(),
            round.DraftSkillItems
                .OrderBy(item => item.ExpectedLevelOrdinal)
                .Select(item => new EvaluationRoundSkillItemDto(
                    item.Id, item.SkillId, item.SkillName, item.CategoryName,
                    item.ExpectedLevelOrdinal,
                    draftLabelByOrdinal.GetValueOrDefault(item.ExpectedLevelOrdinal))).ToArray());
    }
}
