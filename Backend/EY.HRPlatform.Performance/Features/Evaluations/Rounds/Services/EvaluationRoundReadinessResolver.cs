using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Dtos;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Evaluations.Rounds.Services;

public sealed record EvaluationRoundReadinessResult(
    EvaluationRoundReadinessDto Dto,
    PerformanceCycle Campaign,
    EvaluationRatingScale? Scale,
    EvaluationTemplate? Template,
    IReadOnlyList<EvaluationRoundLaunchCandidate> Candidates);

public interface IEvaluationRoundReadinessResolver
{
    Task<EvaluationRoundReadinessResult> ResolveAsync(EvaluationRound round, CancellationToken cancellationToken);
}

public sealed class EvaluationRoundReadinessResolver(
    PerformanceDbContext db,
    EffectiveReviewerResolver reviewerResolver) : IEvaluationRoundReadinessResolver
{
    private static readonly TimeSpan ShortDeadlineThreshold = TimeSpan.FromDays(7);

    public async Task<EvaluationRoundReadinessResult> ResolveAsync(
        EvaluationRound round,
        CancellationToken cancellationToken)
    {
        var campaign = await db.PerformanceCycles
            .AsSplitQuery()
            .Include(c => c.Participants)
            .SingleAsync(c => c.Id == round.PerformanceCycleId, cancellationToken);

        var scale = round.SourceRatingScaleId.HasValue
            ? await db.EvaluationRatingScales.Include(x => x.Levels)
                .SingleOrDefaultAsync(x => x.Id == round.SourceRatingScaleId, cancellationToken)
            : null;
        var template = round.SourceTemplateId.HasValue
            ? await db.EvaluationTemplates.AsSplitQuery().Include(x => x.Sections).Include(x => x.Questions)
                .SingleOrDefaultAsync(x => x.Id == round.SourceTemplateId, cancellationToken)
            : null;

        var latestReassignments = (await db.PerformanceCycleApproverReassignments
                .AsNoTracking()
                .Where(x => x.CycleId == campaign.Id)
                .OrderBy(x => x.ReassignedAt)
                .ToListAsync(cancellationToken))
            .GroupBy(x => x.ParticipantEmployeeId)
            .ToDictionary(g => g.Key, g => g.Last());
        var effectiveReviewerIds = await reviewerResolver.ResolveForCampaignAsync(campaign.Id, cancellationToken);

        var plans = await db.EmployeeObjectivePlans
            .AsNoTracking()
            .AsSplitQuery()
            .Include(x => x.Objectives)
            .Where(x => x.CycleId == campaign.Id && x.Status == PlanStatus.Approved)
            .ToListAsync(cancellationToken);
        var planByEmployee = plans.GroupBy(x => x.EmployeeId).ToDictionary(g => g.Key, g => g.First());

        var blockers = new List<EvaluationReadinessIssueDto>();
        var warnings = new List<EvaluationReadinessIssueDto>();
        if (round.Status != EvaluationRoundStatus.Draft)
            blockers.Add(new("Round.NotDraft", "Only a draft round can be launched."));
        if (campaign.Status != PerformanceCycleStatus.Launched)
            blockers.Add(new("Campaign.NotLaunched", "The campaign must be launched first."));
        if (!campaign.IsPlanningLocked)
            blockers.Add(new("Campaign.PlanningUnlocked", "Lock objective planning before launching evaluations."));
        if (scale is null || scale.Status != EvaluationConfigStatus.Active)
            blockers.Add(new("Round.ScaleMissing", "Select an active rating scale."));
        if (template is null || template.Status != EvaluationConfigStatus.Active)
            blockers.Add(new("Round.TemplateMissing", "Select an active evaluation template."));
        else if (template.Sections.All(section => section.Type == EvaluationSectionType.OverallComments))
            // Spec: the template must contain at least one meaningful assessment section.
            // Overall-comments-only satisfies Activate()'s >=1 section rule but carries no scoring
            // or contextual content, so it is not enough to launch against.
            blockers.Add(new("Round.TemplateNoAssessableSection",
                "The template needs at least one assessment section beyond overall comments."));
        if (!round.ManagerAssessmentDeadline.HasValue || !round.FinalizationDeadline.HasValue ||
            (round.AssessmentModel == EvaluationAssessmentModel.SelfAndManager && !round.SelfAssessmentDeadline.HasValue))
            blockers.Add(new("Round.DeadlinesMissing", "Set every required deadline."));
        if (campaign.Participants.Count == 0)
            blockers.Add(new("Round.EmptyPopulation", "The campaign has no frozen participants."));

        var candidates = new List<EvaluationRoundLaunchCandidate>();
        var preview = new List<EvaluationRoundAssignmentPreviewDto>();
        var included = 0;
        foreach (var participant in campaign.Participants)
        {
            var reassignment = latestReassignments.GetValueOrDefault(participant.EmployeeId);
            var reviewerId = effectiveReviewerIds.GetValueOrDefault(participant.EmployeeId);
            var reviewerName = reassignment?.NewApproverName ?? participant.ApproverName;
            var correction = round.ReviewerCorrections.SingleOrDefault(x => x.ParticipantEmployeeId == participant.EmployeeId);
            var effectiveId = correction?.ReviewerEmployeeId ?? reviewerId;
            var effectiveName = correction?.ReviewerName ?? reviewerName;
            planByEmployee.TryGetValue(participant.EmployeeId, out var plan);
            // Carry the correction-applied reviewer so the launch candidate matches the readiness
            // preview. Launch also re-applies corrections defensively, so this stays consistent.
            candidates.Add(new EvaluationRoundLaunchCandidate(participant, effectiveId, effectiveName, plan));

            var excluded = round.Exclusions.Any(x => x.ParticipantEmployeeId == participant.EmployeeId);
            var eligiblePlan = !round.IncludesObjectives || plan is not null;
            var omission = excluded ? "Excluded from this round." : !eligiblePlan
                ? "Approved objectives are missing from the locked campaign baseline." : null;
            var isIncluded = !excluded && eligiblePlan;
            if (isIncluded)
            {
                included++;
                if (effectiveId == Guid.Empty)
                    blockers.Add(new("Round.ReviewerMissing", $"{participant.FullName} has no reviewer.", participant.EmployeeId));
                else if (effectiveId == participant.EmployeeId)
                    blockers.Add(new("Round.SelfReview", $"{participant.FullName} cannot review themselves.", participant.EmployeeId));
            }
            else if (!excluded && !eligiblePlan)
            {
                warnings.Add(new("Round.ObjectivePlanOmitted", $"{participant.FullName} will be omitted because approved objectives are missing.", participant.EmployeeId));
            }

            preview.Add(new EvaluationRoundAssignmentPreviewDto(
                participant.EmployeeId, participant.FullName, effectiveId == Guid.Empty ? null : effectiveId,
                effectiveName, isIncluded, eligiblePlan, omission));
        }
        if (included == 0)
            blockers.Add(new("Round.NoEligibleParticipants", "No eligible participants remain after exclusions and objective-plan checks."));

        if (round.ManagerAssessmentDeadline is { } managerDeadline &&
            managerDeadline - DateTime.UtcNow < ShortDeadlineThreshold)
            warnings.Add(new("Round.ShortDeadline",
                "The manager assessment deadline gives reviewers little time to respond."));

        if (template is not null)
        {
            var customQuestionsSection = template.Sections
                .FirstOrDefault(section => section.Type == EvaluationSectionType.CustomQuestions);
            var hasContextualQuestions = customQuestionsSection is not null &&
                template.Questions.Any(question => question.SectionId == customQuestionsSection.Id);
            if (!hasContextualQuestions)
                warnings.Add(new("Round.NoContextualQuestions",
                    "This round has no contextual questions to guide reviewers."));
        }

        var dto = new EvaluationRoundReadinessDto(
            round.Id, blockers.Count == 0, campaign.Participants.Count, included,
            preview.Count(x => !x.Included && x.OmissionReason is not null), included,
            round.AssessmentModel == EvaluationAssessmentModel.SelfAndManager ? included : 0,
            blockers, warnings, preview);
        return new EvaluationRoundReadinessResult(dto, campaign, scale, template, candidates);
    }
}
