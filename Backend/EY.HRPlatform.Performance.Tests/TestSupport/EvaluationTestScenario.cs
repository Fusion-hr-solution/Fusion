using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.TestSupport;

/// <summary>
/// Seeds a launched + planning-locked campaign with an active rating scale, an active template
/// (Objectives + custom questions + overall comments), approved employee objective plans, and a
/// draft <see cref="EvaluationRound"/> with scale/template/deadlines selected. Mirrors the
/// production launch pre-conditions so <c>Features/Evaluations/*</c> handler tests can exercise the
/// real handlers end-to-end over EF InMemory.
/// </summary>
internal static class EvaluationTestScenario
{
    internal static readonly DateTime Start = new(2026, 1, 1, 9, 0, 0, DateTimeKind.Utc);

    internal sealed record SeededParticipant(Guid EmployeeId, Guid ReviewerId, string ReviewerName, bool HasApprovedPlan);

    internal sealed record Result(
        Guid TenantId,
        Guid CampaignId,
        Guid RoundId,
        uint RoundVersion,
        Guid ScaleId,
        Guid TemplateId,
        IReadOnlyList<SeededParticipant> Participants);

    internal sealed record Options(
        EvaluationAssessmentModel AssessmentModel = EvaluationAssessmentModel.SelfAndManager,
        bool IncludeParticipantMissingPlan = false,
        bool IncludeSelfReviewParticipant = false,
        bool IncludeCustomQuestions = true,
        bool AssessableTemplate = true,
        bool IncludeObjectivesSection = true,
        bool LockPlanning = true,
        DateTime? ManagerDeadline = null);

    /// <summary>Seeds the full scenario into <paramref name="db"/> and returns the created ids.</summary>
    internal static async Task<Result> SeedAsync(
        PerformanceDbContext db,
        Guid tenantId,
        Options? options = null,
        CancellationToken ct = default)
    {
        var opts = options ?? new Options();

        var normalReviewer = Guid.NewGuid();
        var participantSpecs = new List<SeededParticipant>
        {
            new(Guid.NewGuid(), normalReviewer, "Mia Manager", HasApprovedPlan: true),
            new(Guid.NewGuid(), Guid.NewGuid(), "Noah Manager", HasApprovedPlan: true),
        };
        if (opts.IncludeParticipantMissingPlan)
            participantSpecs.Add(new(Guid.NewGuid(), Guid.NewGuid(), "Ola Manager", HasApprovedPlan: false));
        if (opts.IncludeSelfReviewParticipant)
        {
            var self = Guid.NewGuid();
            participantSpecs.Add(new(self, self, "Self Reviewer", HasApprovedPlan: true));
        }

        var cycle = PerformanceCycle.CreateDraft(
            tenantId,
            "FY26 Evaluation",
            $"fy26-eval-{Guid.NewGuid():N}",
            2026,
            "Evaluation readiness scenario",
            Guid.NewGuid(),
            "HR Admin",
            Start,
            Start.AddDays(14),
            Start.AddDays(21),
            Start.AddDays(30),
            CampaignPlanningRulesSnapshot.Capture(3, "[25,50,75,100]", "Quantitative,Qualitative", Guid.NewGuid(), Start));
        var strategic = cycle.AddStrategicObjective("Improve client delivery", "Raise delivery quality", "Consulting");

        cycle.Launch(
            participantSpecs
                .Select(p => new ResolvedLaunchParticipant(p.EmployeeId, $"Employee {p.EmployeeId:N}", p.ReviewerId, p.ReviewerName, false, null))
                .ToArray(),
            Start.AddDays(1));

        db.PerformanceCycles.Add(cycle);
        db.CampaignStrategicObjectives.Add(strategic);

        // Approved employee objective plans for participants that should carry one.
        foreach (var spec in participantSpecs.Where(p => p.HasApprovedPlan))
        {
            var participant = cycle.Participants.Single(x => x.EmployeeId == spec.EmployeeId);
            var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
            plan.AddObjective(
                cycle,
                "Improve delivery quality",
                ObjectiveAlignmentType.StrategicObjective,
                strategic.Id,
                strategic.Title,
                100,
                Start.AddDays(10),
                "Quantitative",
                "NPS",
                "60",
                "%",
                Start.AddDays(2));
            plan.Submit(cycle, participant, Start.AddDays(3));
            plan.Approve(new EmployeeObjectivePlanReviewActor(participant.ApproverEmployeeId, participant.ApproverName), Start.AddDays(4), "Ready for evaluation.");
            db.EmployeeObjectivePlans.Add(plan);
        }

        if (opts.LockPlanning)
            cycle.LockPlanning(Guid.NewGuid(), "HR Admin", Start.AddDays(31));

        var scale = EvaluationRatingScale.CreateDraft(
            tenantId, "Three-level scale", "Standard", [new("Below"), new("Meets"), new("Exceeds")]);
        scale.Activate();
        db.EvaluationRatingScales.Add(scale);

        var template = EvaluationTemplate.CreateDraft(tenantId, "Annual template", "Annual review", null);
        if (opts.AssessableTemplate)
        {
            if (opts.IncludeObjectivesSection)
                template.AddSection(new EvaluationTemplateSectionDraft(EvaluationSectionType.Objectives, "Objectives"));
            var customSection = template.AddSection(new EvaluationTemplateSectionDraft(EvaluationSectionType.CustomQuestions, "Reflection"));
            if (opts.IncludeCustomQuestions)
                template.AddQuestion(customSection.Id, new EvaluationTemplateQuestionDraft(
                    "What went well?", EvaluationQuestionType.Text, true, EvaluationTargetRater.Both, false));
        }
        template.AddSection(new EvaluationTemplateSectionDraft(EvaluationSectionType.OverallComments, "Overall comments"));
        template.Activate();
        db.EvaluationTemplates.Add(template);

        var round = EvaluationRound.CreateDraft(
            tenantId, cycle, "Mid-cycle evaluation", "Review delivery and priorities",
            EvaluationRoundType.MidCycle, opts.AssessmentModel);
        round.SelectRatingScale(scale);
        round.SelectTemplate(template);
        // Round deadlines are compared to real UtcNow by the readiness resolver (short-deadline
        // warning), so default them comfortably in the future to keep the baseline warning-free.
        var managerDeadline = opts.ManagerDeadline ?? DateTime.UtcNow.AddDays(30);
        round.SetDeadlines(
            opts.AssessmentModel == EvaluationAssessmentModel.SelfAndManager ? managerDeadline.AddDays(-7) : null,
            managerDeadline,
            managerDeadline.AddDays(7));
        db.EvaluationRounds.Add(round);

        await db.SaveChangesAsync(ct);

        return new Result(tenantId, cycle.Id, round.Id, round.Version, scale.Id, template.Id, participantSpecs);
    }

    /// <summary>
    /// Seeds the scenario and launches the round via the domain aggregate as a single fresh insert —
    /// mirroring <c>AtlasPerformanceDemoSeeder</c> — so the generated assignments are persisted.
    /// The production <c>LaunchEvaluationRoundCommandHandler</c> reloads a persisted draft and
    /// updates it; that update path cannot be saved under EF InMemory, because navigation children
    /// added to an already-tracked aggregate are misclassified as Modified. This fresh-insert path
    /// is the exact one the shipped seeder uses, so the generated assignment graph is exercised.
    /// </summary>
    internal static async Task<Result> SeedAndLaunchFreshAsync(
        PerformanceDbContext db,
        Guid tenantId,
        Options? options = null,
        CancellationToken ct = default)
    {
        var seeded = await SeedAsync(db, tenantId, options, ct);
        var round = await db.EvaluationRounds
            .Include(r => r.DraftScaleLevels).Include(r => r.DraftTemplateSections).Include(r => r.DraftTemplateQuestions)
            .SingleAsync(r => r.Id == seeded.RoundId, ct);
        var campaign = await db.PerformanceCycles.Include(c => c.Participants).SingleAsync(c => c.Id == seeded.CampaignId, ct);
        var scale = await db.EvaluationRatingScales.Include(s => s.Levels).SingleAsync(s => s.Id == seeded.ScaleId, ct);
        var template = await db.EvaluationTemplates.Include(t => t.Sections).Include(t => t.Questions).SingleAsync(t => t.Id == seeded.TemplateId, ct);
        var plans = await db.EmployeeObjectivePlans.Include(p => p.Objectives)
            .Where(p => p.CycleId == campaign.Id && p.Status == PlanStatus.Approved).ToListAsync(ct);
        var planByEmployee = plans.GroupBy(p => p.EmployeeId).ToDictionary(g => g.Key, g => g.First());

        // Launch expects a candidate for every frozen participant; it omits ineligible ones internally.
        var candidates = campaign.Participants
            .Select(p => new EvaluationRoundLaunchCandidate(
                p, p.ApproverEmployeeId, p.ApproverName, planByEmployee.GetValueOrDefault(p.EmployeeId)))
            .ToArray();

        var freshRound = EvaluationRound.CreateDraft(
            tenantId, campaign, "Launched evaluation", "Fresh-insert launch",
            EvaluationRoundType.MidCycle, round.AssessmentModel);
        freshRound.SelectRatingScale(scale);
        freshRound.SelectTemplate(template);
        freshRound.SetDeadlines(
            round.AssessmentModel == EvaluationAssessmentModel.SelfAndManager ? round.SelfAssessmentDeadline : null,
            round.ManagerAssessmentDeadline!.Value,
            round.FinalizationDeadline!.Value);
        var result = freshRound.Launch(campaign, scale, template, candidates, DateTime.UtcNow);
        db.EvaluationRounds.Add(freshRound);
        db.EvaluationAssignments.AddRange(result.Assignments);
        await db.SaveChangesAsync(ct);

        return seeded with { RoundId = freshRound.Id };
    }
}
