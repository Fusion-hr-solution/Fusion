using EY.HRPlatform.Performance.Domain.Entities.Skills;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class SkillsDomainTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    // ---- SkillCategory ----

    [Fact]
    public void SkillCategory_Create_NormalizesNameAndIsActive()
    {
        var category = SkillCategory.Create(TenantId, "  Technical  ");

        Assert.Equal("Technical", category.Name);
        Assert.Equal(SkillLifecycleStatus.Active, category.Status);
    }

    [Fact]
    public void SkillCategory_Archive_IsTerminalAndReadOnly()
    {
        var category = SkillCategory.Create(TenantId, "Technical");

        category.Archive();
        Assert.Equal(SkillLifecycleStatus.Archived, category.Status);
        Assert.Throws<DomainRuleViolationException>(() => category.Rename("Changed"));
        Assert.Throws<DomainRuleViolationException>(category.Archive);
    }

    // ---- Skill ----

    [Fact]
    public void Skill_Create_IsActiveWithoutDraft()
    {
        var skill = CreateSkill();

        Assert.Equal(SkillLifecycleStatus.Active, skill.Status);
        Assert.False(skill.IsInUse);
    }

    [Fact]
    public void Skill_WhenInUse_BlocksRenameAndRecategorizeButAllowsArchive()
    {
        var skill = CreateSkill();
        skill.MarkInUse();

        Assert.Throws<DomainRuleViolationException>(() =>
            skill.Update("Renamed", null, Guid.NewGuid()));

        skill.Archive();
        Assert.Equal(SkillLifecycleStatus.Archived, skill.Status);
    }

    // ---- ProficiencyScale ----

    [Theory]
    [InlineData(2)]
    [InlineData(8)]
    public void ProficiencyScale_Create_RejectsLevelCountOutsideBounds(int count)
    {
        var levels = Enumerable.Range(1, count)
            .Select(index => new ProficiencyScaleLevelDraft($"Level {index}"))
            .ToArray();

        Assert.Throws<DomainRuleViolationException>(() =>
            ProficiencyScale.CreateDraft(TenantId, "Scale", null, levels));
    }

    [Fact]
    public void ProficiencyScale_Lifecycle_IsDraftActiveArchived()
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
    public void ProficiencyScale_WhenInUse_BlocksStructuralChanges()
    {
        var scale = CreateScale();
        scale.Activate();
        scale.MarkInUse();

        var first = scale.Levels.First();
        Assert.Throws<DomainRuleViolationException>(() =>
            scale.UpdateLevel(first.Id, "Relabelled", null));
        Assert.Throws<DomainRuleViolationException>(() =>
            scale.AddLevel(new ProficiencyScaleLevelDraft("Extra")));
        Assert.Throws<DomainRuleViolationException>(() => scale.RemoveLevel(first.Id));
    }

    [Fact]
    public void ProficiencyScale_Duplicate_ProducesEditableDraftCopy()
    {
        var scale = CreateScale();
        scale.Activate();
        scale.MarkInUse();

        var copy = scale.Duplicate("Copy of scale");

        Assert.Equal(EvaluationConfigStatus.Draft, copy.Status);
        Assert.False(copy.IsInUse);
        Assert.NotEqual(scale.Id, copy.Id);
        Assert.Equal(scale.Levels.Count, copy.Levels.Count);
        // Editable because it is a fresh draft.
        copy.AddLevel(new ProficiencyScaleLevelDraft("Added"));
        Assert.Equal(scale.Levels.Count + 1, copy.Levels.Count);
    }

    // ---- SkillExpectationSet ----

    [Fact]
    public void ExpectationSet_AddItem_RejectsOrdinalOutsideScale()
    {
        var scale = CreateScale();
        scale.Activate();
        var set = SkillExpectationSet.CreateDraft(TenantId, "Core capabilities", null, scale.Id);

        Assert.Throws<DomainRuleViolationException>(() =>
            set.AddItem(Guid.NewGuid(), 99, scale));
    }

    [Fact]
    public void ExpectationSet_AddItem_RejectsDuplicateSkill()
    {
        var scale = CreateScale();
        scale.Activate();
        var set = SkillExpectationSet.CreateDraft(TenantId, "Core capabilities", null, scale.Id);
        var skillId = Guid.NewGuid();

        set.AddItem(skillId, 2, scale);
        Assert.Throws<DomainRuleViolationException>(() => set.AddItem(skillId, 3, scale));
    }

    [Fact]
    public void ExpectationSet_Activate_RequiresItemsAndActiveScale()
    {
        var scale = CreateScale();
        scale.Activate();
        var set = SkillExpectationSet.CreateDraft(TenantId, "Core capabilities", null, scale.Id);

        Assert.Throws<DomainRuleViolationException>(() => set.Activate(scale));

        set.AddItem(Guid.NewGuid(), 2, scale);
        set.Activate(scale);
        Assert.Equal(EvaluationConfigStatus.Active, set.Status);
    }

    [Fact]
    public void ExpectationSet_WhenInUse_BlocksStructuralChanges()
    {
        var scale = CreateScale();
        scale.Activate();
        var set = SkillExpectationSet.CreateDraft(TenantId, "Core capabilities", null, scale.Id);
        var item = set.AddItem(Guid.NewGuid(), 2, scale);
        set.Activate(scale);
        set.MarkInUse();

        Assert.Throws<DomainRuleViolationException>(() => set.AddItem(Guid.NewGuid(), 2, scale));
        Assert.Throws<DomainRuleViolationException>(() => set.RemoveItem(item.Id));
        Assert.Throws<DomainRuleViolationException>(() =>
            set.UpdateItemExpectedLevel(item.Id, 3, scale));
    }

    [Fact]
    public void ExpectationSet_Duplicate_CopiesItemsIntoEditableDraft()
    {
        var scale = CreateScale();
        scale.Activate();
        var set = SkillExpectationSet.CreateDraft(TenantId, "Core capabilities", null, scale.Id);
        set.AddItem(Guid.NewGuid(), 2, scale);
        set.Activate(scale);
        set.MarkInUse();

        var copy = set.Duplicate("Copy of set");

        Assert.Equal(EvaluationConfigStatus.Draft, copy.Status);
        Assert.False(copy.IsInUse);
        Assert.Single(copy.Items);
        copy.AddItem(Guid.NewGuid(), 3, scale);
        Assert.Equal(2, copy.Items.Count);
    }

    // ---- helpers ----

    private static Skill CreateSkill() =>
        Skill.Create(TenantId, "C# Development", "Backend engineering", Guid.NewGuid());

    private static ProficiencyScale CreateScale() =>
        ProficiencyScale.CreateDraft(
            TenantId,
            "Proficiency",
            null,
            new[]
            {
                new ProficiencyScaleLevelDraft("Foundational"),
                new ProficiencyScaleLevelDraft("Proficient"),
                new ProficiencyScaleLevelDraft("Expert")
            });
}
