using EY.HRPlatform.Performance.Domain.Defaults;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class EvaluationConfigurationTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public void RatingScale_Create_DerivesValuesFromOrderedLevels()
    {
        var scale = CreateScale();

        Assert.Equal(EvaluationConfigStatus.Draft, scale.Status);
        Assert.Equal([1, 2, 3], scale.Levels.Select(level => level.Ordinal));
        Assert.Equal([1, 2, 3], scale.Levels.Select(level => level.Value));
        Assert.All(scale.Levels, level => Assert.Equal(TenantId, level.TenantId));
    }

    [Theory]
    [InlineData(2)]
    [InlineData(8)]
    public void RatingScale_Create_RejectsLevelCountOutsideBounds(int count)
    {
        var levels = Enumerable.Range(1, count)
            .Select(index => new EvaluationRatingScaleLevelDraft($"Level {index}"))
            .ToArray();

        Assert.Throws<DomainRuleViolationException>(() =>
            EvaluationRatingScale.CreateDraft(TenantId, "Scale", null, levels));
    }

    [Fact]
    public void RatingScale_Lifecycle_IsDraftActiveArchived()
    {
        var scale = CreateScale();

        scale.Activate();
        Assert.Equal(EvaluationConfigStatus.Active, scale.Status);

        scale.Archive();
        Assert.Equal(EvaluationConfigStatus.Archived, scale.Status);

        Assert.Throws<DomainRuleViolationException>(scale.Activate);
        Assert.Throws<DomainRuleViolationException>(() => scale.UpdateDetails("Changed", null));
    }

    [Fact]
    public void RatingScale_WhenInUse_BlocksStructuralChangesAndReferencedDeletion()
    {
        var scale = CreateScale();
        scale.Activate();
        scale.MarkInUse();

        var first = scale.Levels.First();
        Assert.Throws<DomainRuleViolationException>(() =>
            scale.UpdateLevel(first.Id, "Relabelled", null, null));
        Assert.Throws<DomainRuleViolationException>(() =>
            scale.AddLevel(new EvaluationRatingScaleLevelDraft("Fourth")));
        Assert.Throws<DomainRuleViolationException>(() =>
            scale.ReorderLevels(scale.Levels.Reverse().Select(level => level.Id).ToArray()));
        Assert.Throws<DomainRuleViolationException>(() => scale.EnsureCanDelete(true));
    }

    [Fact]
    public void RatingScale_Duplicate_IsAnIndependentDraft()
    {
        var source = CreateScale();
        source.Activate();
        source.MarkInUse();

        var copy = source.Duplicate("Copied scale");
        var copiedFirst = copy.Levels.First();
        copy.UpdateLevel(copiedFirst.Id, "Changed in copy", null, null);

        Assert.Equal(EvaluationConfigStatus.Draft, copy.Status);
        Assert.False(copy.IsInUse);
        Assert.NotEqual(source.Id, copy.Id);
        Assert.DoesNotContain(source.Levels, level => level.Id == copiedFirst.Id);
        Assert.Equal("Low", source.Levels.First().Label);
        Assert.Equal("Changed in copy", copy.Levels.First().Label);
    }

    [Fact]
    public void Template_AcceptsSkillsOncePerTypeButRejectsTextNotApplicable()
    {
        var template = EvaluationTemplate.CreateDraft(TenantId, "Annual review");

        template.AddSection(new EvaluationTemplateSectionDraft(EvaluationSectionType.Skills, "Skills"));
        Assert.Contains(template.Sections, section => section.Type == EvaluationSectionType.Skills);
        Assert.Throws<DomainRuleViolationException>(() => template.AddSection(
            new EvaluationTemplateSectionDraft(EvaluationSectionType.Skills, "Skills again")));

        var custom = template.AddSection(
            new EvaluationTemplateSectionDraft(EvaluationSectionType.CustomQuestions, "Questions"));

        Assert.Throws<DomainRuleViolationException>(() => template.AddQuestion(
            custom.Id,
            new EvaluationTemplateQuestionDraft(
                "Question",
                EvaluationQuestionType.Text,
                true,
                EvaluationTargetRater.Both,
                true)));
    }

    [Fact]
    public void Template_Preview_FiltersQuestionsByRaterWithoutMutation()
    {
        var template = EvaluationTemplate.CreateDraft(TenantId, "Annual review");
        var custom = template.AddSection(
            new EvaluationTemplateSectionDraft(EvaluationSectionType.CustomQuestions, "Questions"));
        template.AddQuestion(custom.Id, Question("Self question", EvaluationTargetRater.Self));
        template.AddQuestion(custom.Id, Question("Manager question", EvaluationTargetRater.Manager));
        template.AddQuestion(custom.Id, Question("Shared question", EvaluationTargetRater.Both));
        var originalQuestionIds = template.Questions.Select(question => question.Id).ToArray();

        var employee = template.PreviewFor(EvaluationTargetRater.Self);
        var manager = template.PreviewFor(EvaluationTargetRater.Manager);

        Assert.Equal(["Self question", "Shared question"],
            employee.Sections.Single().Questions.Select(question => question.Prompt));
        Assert.Equal(["Manager question", "Shared question"],
            manager.Sections.Single().Questions.Select(question => question.Prompt));
        Assert.Equal(originalQuestionIds, template.Questions.Select(question => question.Id));
    }

    [Fact]
    public void Template_Duplicate_IsIndependentAndInUseSourceIsFrozen()
    {
        var source = EvaluationTemplate.CreateDraft(TenantId, "Annual review");
        var custom = source.AddSection(
            new EvaluationTemplateSectionDraft(EvaluationSectionType.CustomQuestions, "Questions"));
        source.AddQuestion(custom.Id, Question("Original", EvaluationTargetRater.Both));
        source.Activate();
        source.MarkInUse();

        Assert.Throws<DomainRuleViolationException>(() => source.UpdateQuestion(
            source.Questions.Single().Id,
            Question("Blocked", EvaluationTargetRater.Both)));

        var copy = source.Duplicate("Annual review copy");
        copy.UpdateQuestion(copy.Questions.Single().Id, Question("Changed", EvaluationTargetRater.Both));

        Assert.Equal(EvaluationConfigStatus.Draft, copy.Status);
        Assert.Equal("Original", source.Questions.Single().Prompt);
        Assert.Equal("Changed", copy.Questions.Single().Prompt);
        Assert.NotEqual(source.Sections.Single().Id, copy.Sections.Single().Id);
        Assert.NotEqual(source.Questions.Single().Id, copy.Questions.Single().Id);
    }

    [Fact]
    public void ProductDefaults_AreIndependentTenantOwnedCopies()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var first = EvaluationConfigurationDefaults.InstantiateForTenant(tenantA);
        var second = EvaluationConfigurationDefaults.InstantiateForTenant(tenantB);

        first.RatingScale.UpdateLevel(
            first.RatingScale.Levels.First().Id,
            "Tenant A wording",
            null,
            null);
        first.Template.UpdateDetails("Tenant A annual review", null, null);

        Assert.Equal(tenantA, first.RatingScale.TenantId);
        Assert.All(first.RatingScale.Levels, level => Assert.Equal(tenantA, level.TenantId));
        Assert.Equal(tenantB, second.RatingScale.TenantId);
        Assert.Equal("Does not meet expectations", second.RatingScale.Levels.First().Label);
        Assert.Equal(EvaluationConfigurationDefaults.DefaultTemplateName, second.Template.Name);
        Assert.NotEqual(first.RatingScale.Id, second.RatingScale.Id);
        Assert.NotEqual(first.Template.Id, second.Template.Id);
    }

    private static EvaluationRatingScale CreateScale() =>
        EvaluationRatingScale.CreateDraft(
            TenantId,
            "Three-level scale",
            null,
            [new("Low"), new("Expected"), new("High")]);

    private static EvaluationTemplateQuestionDraft Question(
        string prompt,
        EvaluationTargetRater rater) =>
        new(prompt, EvaluationQuestionType.Text, true, rater);
}
