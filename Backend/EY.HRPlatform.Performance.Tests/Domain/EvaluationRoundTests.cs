using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class EvaluationRoundTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly DateTime Start = new(2026, 1, 1, 9, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime LaunchTime = Start.AddMonths(2);

    [Fact]
    public void CreateDraft_CopiesSelectedConfigurationWithoutMutatingSources()
    {
        var setup = Setup(EvaluationAssessmentModel.SelfAndManager);
        var sourceScaleLabel = setup.Scale.Levels.First().Label;
        var sourceSectionTitle = setup.Template.Sections.Single().Title;

        setup.Round.UpdateDraftScaleLevel(
            setup.Round.DraftScaleLevels.First().Id,
            "Round wording",
            null,
            null);
        setup.Round.UpdateDraftTemplateSection(
            setup.Round.DraftTemplateSections.Single().Id,
            "Round comments",
            null);

        Assert.Equal(sourceScaleLabel, setup.Scale.Levels.First().Label);
        Assert.Equal(sourceSectionTitle, setup.Template.Sections.Single().Title);
        Assert.Equal("Round wording", setup.Round.DraftScaleLevels.First().Label);
        Assert.Equal("Round comments", setup.Round.DraftTemplateSections.Single().Title);
    }

    [Fact]
    public void CreateDraft_RejectsCrossTenantCampaign()
    {
        var campaign = CreateCampaign(Guid.NewGuid(), selfReviewer: false);

        Assert.Throws<DomainRuleViolationException>(() => EvaluationRound.CreateDraft(
            TenantId,
            campaign,
            "Mid-cycle evaluation",
            null,
            EvaluationRoundType.MidCycle,
            EvaluationAssessmentModel.ManagerOnly));
    }

    [Fact]
    public void SetDeadlines_EnforcesAssessmentModelAndOrdering()
    {
        var selfAndManager = Setup(EvaluationAssessmentModel.SelfAndManager).Round;
        Assert.Throws<DomainRuleViolationException>(() => selfAndManager.SetDeadlines(
            null,
            LaunchTime.AddDays(14),
            LaunchTime.AddDays(21)));
        Assert.Throws<DomainRuleViolationException>(() => selfAndManager.SetDeadlines(
            LaunchTime.AddDays(15),
            LaunchTime.AddDays(14),
            LaunchTime.AddDays(21)));

        var managerOnly = Setup(EvaluationAssessmentModel.ManagerOnly).Round;
        Assert.Throws<DomainRuleViolationException>(() => managerOnly.SetDeadlines(
            LaunchTime.AddDays(7),
            LaunchTime.AddDays(14),
            LaunchTime.AddDays(21)));
    }

    [Fact]
    public void Launch_RefusesIncompleteAndEmptyRounds()
    {
        var campaign = CreateCampaign(TenantId, selfReviewer: false);
        var round = EvaluationRound.CreateDraft(
            TenantId,
            campaign,
            "Mid-cycle evaluation",
            null,
            EvaluationRoundType.MidCycle,
            EvaluationAssessmentModel.ManagerOnly);
        var scale = CreateScale();
        var template = CreateTemplate();
        var candidates = Candidates(campaign);

        Assert.Throws<DomainRuleViolationException>(() =>
            round.Launch(campaign, scale, template, null, null, [], candidates, LaunchTime));

        round.SelectRatingScale(scale);
        round.SelectTemplate(template);
        round.SetDeadlines(null, LaunchTime.AddDays(14), LaunchTime.AddDays(21));
        round.ExcludeParticipant(campaign.Participants.Single(), "Not in this review scope");

        Assert.Throws<DomainRuleViolationException>(() =>
            round.Launch(campaign, scale, template, null, null, [], candidates, LaunchTime));
    }

    [Fact]
    public void Launch_RefusesSelfReviewUntilRoundCorrectionResolvesIt()
    {
        var setup = Setup(EvaluationAssessmentModel.ManagerOnly, selfReviewer: true);
        var participant = setup.Campaign.Participants.Single();
        var candidates = Candidates(setup.Campaign);

        Assert.Throws<DomainRuleViolationException>(() => setup.Round.Launch(
            setup.Campaign,
            setup.Scale,
            setup.Template,
            null,
            null,
            [],
            candidates,
            LaunchTime));

        setup.Round.CorrectReviewer(
            participant,
            participant.EmployeeId,
            Guid.NewGuid(),
            "Corrected manager",
            "Resolve self-review");
        var result = setup.Round.Launch(
            setup.Campaign,
            setup.Scale,
            setup.Template,
            null,
            null,
            [],
            candidates,
            LaunchTime);

        Assert.Single(result.Assignments);
        Assert.NotEqual(participant.EmployeeId, result.Assignments.Single().AssigneeEmployeeId);
    }

    [Fact]
    public void Launch_RejectsDuplicateFrozenParticipants()
    {
        var setup = Setup(EvaluationAssessmentModel.ManagerOnly);
        var candidate = Candidates(setup.Campaign).Single();
        var duplicateCandidates = new[] { candidate, candidate };

        var error = Assert.Throws<DomainRuleViolationException>(() => setup.Round.Launch(
            setup.Campaign,
            setup.Scale,
            setup.Template,
            null,
            null,
            [],
            duplicateCandidates,
            LaunchTime));

        Assert.Contains("only once", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData(EvaluationAssessmentModel.ManagerOnly, 1)]
    [InlineData(EvaluationAssessmentModel.SelfAndManager, 2)]
    public void Launch_FreezesSnapshotAndGeneratesExpectedAssignments(
        EvaluationAssessmentModel model,
        int expectedAssignments)
    {
        var setup = Setup(model);
        var originalScaleName = setup.Scale.Name;
        var originalTemplateName = setup.Template.Name;

        var result = setup.Round.Launch(
            setup.Campaign,
            setup.Scale,
            setup.Template,
            null,
            null,
            [],
            Candidates(setup.Campaign),
            LaunchTime);

        Assert.Equal(EvaluationRoundStatus.Launched, setup.Round.Status);
        Assert.Equal(expectedAssignments, result.Assignments.Count);
        Assert.All(result.Assignments, assignment =>
        {
            Assert.Equal(EvaluationAssignmentStatus.NotStarted, assignment.Status);
            Assert.Equal(setup.Round.ScaleSnapshot!.Id, assignment.ScaleSnapshotId);
            Assert.Equal(setup.Round.TemplateSnapshot!.Id, assignment.TemplateSnapshotId);
        });
        Assert.Equal(
            model == EvaluationAssessmentModel.SelfAndManager
                ? EvaluationVisibilityModel.SelfThenManager
                : EvaluationVisibilityModel.ManagerImmediate,
            setup.Round.PolicySnapshot!.VisibilityModel);

        setup.Scale.UpdateDetails("Source renamed", null);
        setup.Template.UpdateDetails("Source template renamed", null, null);
        Assert.Equal(originalScaleName, setup.Round.ScaleSnapshot!.Name);
        Assert.Equal(originalTemplateName, setup.Round.TemplateSnapshot!.Name);
        Assert.Throws<DomainRuleViolationException>(() => setup.Round.Launch(
            setup.Campaign,
            setup.Scale,
            setup.Template,
            null,
            null,
            [],
            Candidates(setup.Campaign),
            LaunchTime.AddMinutes(1)));
    }

    [Fact]
    public void ExtendDeadline_RequiresReasonAndPreservesOrdering()
    {
        var setup = Setup(EvaluationAssessmentModel.SelfAndManager);
        var result = setup.Round.Launch(
            setup.Campaign,
            setup.Scale,
            setup.Template,
            null,
            null,
            [],
            Candidates(setup.Campaign),
            LaunchTime);
        var originalPolicyDeadline = setup.Round.PolicySnapshot!.ManagerAssessmentDeadline;

        Assert.Throws<DomainRuleViolationException>(() => setup.Round.ExtendDeadline(
            EvaluationDeadlineKind.ManagerAssessment,
            LaunchTime.AddDays(19),
            " ",
            Guid.NewGuid(),
            "HR",
            LaunchTime.AddDays(2)));
        Assert.Throws<DomainRuleViolationException>(() => setup.Round.ExtendDeadline(
            EvaluationDeadlineKind.ManagerAssessment,
            LaunchTime.AddDays(22),
            "More time",
            Guid.NewGuid(),
            "HR",
            LaunchTime.AddDays(2)));

        var extension = setup.Round.ExtendDeadline(
            EvaluationDeadlineKind.ManagerAssessment,
            LaunchTime.AddDays(20),
            "Manager availability",
            Guid.NewGuid(),
            "HR",
            LaunchTime.AddDays(2));

        Assert.Equal(LaunchTime.AddDays(20), setup.Round.ManagerAssessmentDeadline);
        Assert.Equal(originalPolicyDeadline, setup.Round.PolicySnapshot.ManagerAssessmentDeadline);
        Assert.Single(setup.Round.DeadlineExtensions);
        Assert.Equal("Manager availability", extension.Reason);
        Assert.All(result.Assignments, assignment => Assert.Equal(EvaluationAssignmentStatus.NotStarted, assignment.Status));
    }

    [Fact]
    public void OperationalState_IsDerivedWithoutLifecycleMutation()
    {
        var setup = Setup(EvaluationAssessmentModel.ManagerOnly);
        var result = setup.Round.Launch(
            setup.Campaign,
            setup.Scale,
            setup.Template,
            null,
            null,
            [],
            Candidates(setup.Campaign),
            LaunchTime);

        Assert.Equal(EvaluationRoundOperationalState.InProgress,
            setup.Round.GetOperationalState(LaunchTime.AddDays(5), result.Assignments));
        Assert.Equal(EvaluationRoundOperationalState.Overdue,
            setup.Round.GetOperationalState(LaunchTime.AddDays(15), result.Assignments));
        Assert.Equal(EvaluationRoundStatus.Launched, setup.Round.Status);
    }

    private static RoundSetup Setup(
        EvaluationAssessmentModel model,
        bool selfReviewer = false)
    {
        var campaign = CreateCampaign(TenantId, selfReviewer);
        var scale = CreateScale();
        var template = CreateTemplate();
        var round = EvaluationRound.CreateDraft(
            TenantId,
            campaign,
            "Mid-cycle evaluation",
            "Review delivery and priorities",
            EvaluationRoundType.MidCycle,
            model);
        round.SelectRatingScale(scale);
        round.SelectTemplate(template);
        round.SetDeadlines(
            model == EvaluationAssessmentModel.SelfAndManager ? LaunchTime.AddDays(7) : null,
            LaunchTime.AddDays(14),
            LaunchTime.AddDays(21));
        return new RoundSetup(campaign, scale, template, round);
    }

    private static PerformanceCycle CreateCampaign(Guid tenantId, bool selfReviewer)
    {
        var snapshot = CampaignPlanningRulesSnapshot.Capture(
            5,
            "[25,50,75,100]",
            "Quantitative,Qualitative",
            Guid.NewGuid(),
            Start);
        var campaign = PerformanceCycle.CreateDraft(
            tenantId,
            "FY26 campaign",
            $"fy26-{Guid.NewGuid():N}",
            2026,
            "Performance planning",
            Guid.NewGuid(),
            "HR",
            Start,
            Start.AddDays(14),
            Start.AddDays(21),
            Start.AddDays(30),
            snapshot);
        campaign.AddStrategicObjective("Client impact", null, null);

        var employeeId = Guid.NewGuid();
        var reviewerId = selfReviewer ? employeeId : Guid.NewGuid();
        campaign.Launch(
            [new ResolvedLaunchParticipant(employeeId, "Employee", reviewerId, "Manager", false, null)],
            Start.AddDays(1));
        campaign.LockPlanning(Guid.NewGuid(), "HR", Start.AddDays(31));
        return campaign;
    }

    private static EvaluationRatingScale CreateScale()
    {
        var scale = EvaluationRatingScale.CreateDraft(
            TenantId,
            "Three-level scale",
            null,
            [new("Below"), new("Meets"), new("Exceeds")]);
        scale.Activate();
        return scale;
    }

    private static EvaluationTemplate CreateTemplate()
    {
        var template = EvaluationTemplate.CreateDraft(TenantId, "Annual template");
        template.AddSection(new EvaluationTemplateSectionDraft(
            EvaluationSectionType.OverallComments,
            "Overall comments"));
        template.Activate();
        return template;
    }

    private static EvaluationRoundLaunchCandidate[] Candidates(PerformanceCycle campaign) =>
        campaign.Participants
            .Select(participant => new EvaluationRoundLaunchCandidate(
                participant,
                participant.ApproverEmployeeId,
                participant.ApproverName))
            .ToArray();

    private sealed record RoundSetup(
        PerformanceCycle Campaign,
        EvaluationRatingScale Scale,
        EvaluationTemplate Template,
        EvaluationRound Round);
}
