using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Entities.Skills;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class EvaluationRoundSkillsTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly DateTime Start = new(2026, 1, 1, 9, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime LaunchTime = Start.AddMonths(2);

    [Fact]
    public void SelectExpectationSet_CopiesItemsAndLevels_WithoutReferencingSource()
    {
        var setup = SetupSkillsRound();

        Assert.Equal(setup.Set.Id, setup.Round.SourceExpectationSetId);
        Assert.Equal(2, setup.Round.DraftSkillItems.Count);
        Assert.Equal(3, setup.Round.DraftProficiencyLevels.Count);
        Assert.True(setup.Round.IncludesSkills);

        // Editing the source set after selection must not reach the round draft copy.
        var freshSkill = Skill.Create(TenantId, "Late skill", null, Guid.NewGuid());
        setup.Set.UpdateDetails("Renamed source", null);
        Assert.Equal(2, setup.Round.DraftSkillItems.Count);
        Assert.DoesNotContain(setup.Round.DraftSkillItems, item => item.SkillName == "Late skill");
        Assert.NotEqual("Renamed source", setup.Round.DraftSkillSetName);
    }

    [Fact]
    public void DraftEdits_AdjustRoundCopyOnly()
    {
        var setup = SetupSkillsRound();
        var item = setup.Round.DraftSkillItems.First();

        setup.Round.UpdateDraftSkillExpectedLevel(item.Id, 3);
        Assert.Equal(3, setup.Round.DraftSkillItems.Single(x => x.Id == item.Id).ExpectedLevelOrdinal);
        // Source set items are untouched (still expected level 2).
        Assert.All(setup.Set.Items, sourceItem => Assert.Equal(2, sourceItem.ExpectedLevelOrdinal));

        setup.Round.RemoveDraftSkillItem(item.Id);
        Assert.Single(setup.Round.DraftSkillItems);
        Assert.Equal(2, setup.Set.Items.Count);
    }

    [Fact]
    public void UpdateDraftExpectedLevel_RejectsOrdinalOutsideCopiedScale()
    {
        var setup = SetupSkillsRound();
        var item = setup.Round.DraftSkillItems.First();

        Assert.Throws<DomainRuleViolationException>(() =>
            setup.Round.UpdateDraftSkillExpectedLevel(item.Id, 99));
    }

    [Fact]
    public void SetWeights_ValidatesSumAndSectionPresence()
    {
        var setup = SetupSkillsRound();

        Assert.Throws<DomainRuleViolationException>(() => setup.Round.SetWeights(60, 30)); // sum != 100
        Assert.Throws<DomainRuleViolationException>(() => setup.Round.SetWeights(-10, 110)); // out of range

        // Objectives weight > 0 requires an Objectives section (this template has none).
        Assert.Throws<DomainRuleViolationException>(() => setup.Round.SetWeights(40, 60));

        setup.Round.SetWeights(0, 100);
        Assert.Equal(0, setup.Round.ObjectivesWeightPercent);
        Assert.Equal(100, setup.Round.SkillsWeightPercent);
    }

    [Fact]
    public void SetWeights_SkillsWithoutSection_IsRejected()
    {
        var round = SetupObjectiveOnlyRound(out _, out _, out _, out _);
        Assert.Throws<DomainRuleViolationException>(() => round.SetWeights(60, 40));
    }

    [Fact]
    public void RemovingSkillsSection_ResetsWeightsAndClearsSelection()
    {
        var setup = SetupSkillsRound();
        Assert.True(setup.Round.IncludesSkills);

        // Re-selecting a template without a Skills section clears the skill draft + resets weights.
        var objectiveOnlyTemplate = EvaluationTemplate.CreateDraft(TenantId, "Comments only");
        objectiveOnlyTemplate.AddSection(new EvaluationTemplateSectionDraft(
            EvaluationSectionType.OverallComments, "Overall comments"));
        objectiveOnlyTemplate.Activate();

        setup.Round.SelectTemplate(objectiveOnlyTemplate);

        Assert.False(setup.Round.IncludesSkills);
        Assert.Null(setup.Round.SourceExpectationSetId);
        Assert.Empty(setup.Round.DraftSkillItems);
        Assert.Equal(100, setup.Round.ObjectivesWeightPercent);
        Assert.Equal(0, setup.Round.SkillsWeightPercent);
    }

    [Fact]
    public void Launch_CapturesSkillSnapshotAndMarksSourcesInUse()
    {
        var setup = SetupSkillsRound();

        var result = setup.Round.Launch(
            setup.Campaign,
            setup.Scale,
            setup.Template,
            setup.Set,
            setup.Proficiency,
            setup.Skills,
            Candidates(setup.Campaign),
            LaunchTime);

        Assert.NotNull(setup.Round.SkillSnapshot);
        Assert.Equal(setup.Set.Id, setup.Round.SkillSnapshot!.SourceExpectationSetId);
        Assert.Equal(2, setup.Round.SkillSnapshot.Items.Count);
        Assert.Equal(3, setup.Round.SkillSnapshot.Levels.Count);
        Assert.Equal(0, setup.Round.PolicySnapshot!.ObjectivesWeightPercent);
        Assert.Equal(100, setup.Round.PolicySnapshot.SkillsWeightPercent);

        Assert.True(setup.Set.IsInUse);
        Assert.True(setup.Proficiency.IsInUse);
        Assert.All(setup.Skills, skill => Assert.True(skill.IsInUse));

        // Every generated assignment references the single round skill snapshot.
        Assert.All(result.Assignments, assignment =>
            Assert.Equal(setup.Round.SkillSnapshot!.Id, assignment.SkillSnapshotId));
    }

    [Fact]
    public void Launch_BlockedWhenAllDraftSkillItemsRemoved()
    {
        var setup = SetupSkillsRound();
        foreach (var item in setup.Round.DraftSkillItems.ToArray())
            setup.Round.RemoveDraftSkillItem(item.Id);

        Assert.Throws<DomainRuleViolationException>(() => setup.Round.Launch(
            setup.Campaign,
            setup.Scale,
            setup.Template,
            setup.Set,
            setup.Proficiency,
            setup.Skills,
            Candidates(setup.Campaign),
            LaunchTime));
    }

    [Fact]
    public void Launch_ObjectiveOnlyRound_LeavesSkillSnapshotIdNull()
    {
        var round = SetupObjectiveOnlyRound(
            out var campaign,
            out var scale,
            out var template,
            out _);

        var result = round.Launch(
            campaign,
            scale,
            template,
            sourceExpectationSet: null,
            sourceProficiencyScale: null,
            referencedSkills: [],
            Candidates(campaign),
            LaunchTime);

        Assert.Null(round.SkillSnapshot);
        Assert.Equal(100, round.PolicySnapshot!.ObjectivesWeightPercent);
        Assert.Equal(0, round.PolicySnapshot.SkillsWeightPercent);
        Assert.All(result.Assignments, assignment => Assert.Null(assignment.SkillSnapshotId));
    }

    [Fact]
    public void SkillSnapshot_IsImmutableToSourceEditsAfterLaunch()
    {
        var setup = SetupSkillsRound();
        setup.Round.Launch(
            setup.Campaign,
            setup.Scale,
            setup.Template,
            setup.Set,
            setup.Proficiency,
            setup.Skills,
            Candidates(setup.Campaign),
            LaunchTime);

        var capturedItemNames = setup.Round.SkillSnapshot!.Items
            .Select(item => item.SkillName)
            .OrderBy(name => name)
            .ToArray();

        // Archiving a source skill (allowed even while in use) must not touch the frozen snapshot.
        setup.Skills.First().Archive();

        var afterEditNames = setup.Round.SkillSnapshot!.Items
            .Select(item => item.SkillName)
            .OrderBy(name => name)
            .ToArray();
        Assert.Equal(capturedItemNames, afterEditNames);
    }

    // ---- helpers ----

    private static SkillRoundSetup SetupSkillsRound()
    {
        var campaign = CreateCampaign(selfReviewer: false);
        var scale = CreateScale();
        var template = CreateTemplateWithSkills();
        var round = EvaluationRound.CreateDraft(
            TenantId,
            campaign,
            "FY2026 year-end evaluation",
            null,
            EvaluationRoundType.MidCycle,
            EvaluationAssessmentModel.ManagerOnly);
        round.SelectRatingScale(scale);
        round.SelectTemplate(template);
        round.SetDeadlines(null, LaunchTime.AddDays(14), LaunchTime.AddDays(21));

        var (proficiency, set, skills, sources) = BuildSkills();
        round.SelectExpectationSet(set, proficiency, sources);
        round.SetWeights(0, 100);
        return new SkillRoundSetup(campaign, scale, template, round, proficiency, set, skills);
    }

    private static EvaluationRound SetupObjectiveOnlyRound(
        out PerformanceCycle campaign,
        out EvaluationRatingScale scale,
        out EvaluationTemplate template,
        out EvaluationRound round)
    {
        campaign = CreateCampaign(selfReviewer: false);
        scale = CreateScale();
        template = EvaluationTemplate.CreateDraft(TenantId, "Comments only");
        template.AddSection(new EvaluationTemplateSectionDraft(
            EvaluationSectionType.OverallComments, "Overall comments"));
        template.Activate();
        round = EvaluationRound.CreateDraft(
            TenantId,
            campaign,
            "Manager-only round",
            null,
            EvaluationRoundType.MidCycle,
            EvaluationAssessmentModel.ManagerOnly);
        round.SelectRatingScale(scale);
        round.SelectTemplate(template);
        round.SetDeadlines(null, LaunchTime.AddDays(14), LaunchTime.AddDays(21));
        return round;
    }

    private static (ProficiencyScale Scale, SkillExpectationSet Set, List<Skill> Skills, List<EvaluationRoundSkillSource> Sources) BuildSkills(int itemCount = 2)
    {
        var proficiency = ProficiencyScale.CreateDraft(
            TenantId,
            "Proficiency",
            null,
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

    private static PerformanceCycle CreateCampaign(bool selfReviewer)
    {
        var snapshot = CampaignPlanningRulesSnapshot.Capture(
            5,
            "[25,50,75,100]",
            "Quantitative,Qualitative",
            Guid.NewGuid(),
            Start);
        var campaign = PerformanceCycle.CreateDraft(
            TenantId,
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

    private static EvaluationTemplate CreateTemplateWithSkills()
    {
        var template = EvaluationTemplate.CreateDraft(TenantId, "Annual template");
        template.AddSection(new EvaluationTemplateSectionDraft(
            EvaluationSectionType.Skills, "Skills"));
        template.AddSection(new EvaluationTemplateSectionDraft(
            EvaluationSectionType.OverallComments, "Overall comments"));
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

    private sealed record SkillRoundSetup(
        PerformanceCycle Campaign,
        EvaluationRatingScale Scale,
        EvaluationTemplate Template,
        EvaluationRound Round,
        ProficiencyScale Proficiency,
        SkillExpectationSet Set,
        List<Skill> Skills);
}
