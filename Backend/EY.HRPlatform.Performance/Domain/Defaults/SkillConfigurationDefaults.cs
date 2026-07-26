using EY.HRPlatform.Performance.Domain.Entities.Skills;

namespace EY.HRPlatform.Performance.Domain.Defaults;

/// <summary>
/// Product-authored starter skills content. Every call creates independent tenant-owned
/// aggregates; these definitions are never persisted or shared as mutable customer data.
/// Instantiated once per tenant on first authorized skills-configuration access.
/// </summary>
public static class SkillConfigurationDefaults
{
    public const string DefaultScaleName = "Five-level proficiency scale";
    public const string DefaultSetName = "Core capabilities";

    public static TenantSkillConfigurationDefaults InstantiateForTenant(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant is required.", nameof(tenantId));

        var scale = ProficiencyScale.CreateDraft(
            tenantId,
            DefaultScaleName,
            "A balanced five-level proficiency scale for consistent skill expectations.",
            [
                new("Foundational", "Building basic familiarity; needs guidance to apply the skill."),
                new("Developing", "Applies the skill on routine work with occasional support."),
                new("Proficient", "Applies the skill independently and reliably across normal work."),
                new("Advanced", "Applies the skill to complex situations and improves how others work."),
                new("Expert", "Sets the standard; recognized reference point across the organization.")
            ]);
        scale.Activate();

        var technical = SkillCategory.Create(tenantId, "Technical");
        var behavioral = SkillCategory.Create(tenantId, "Behavioral");
        var leadership = SkillCategory.Create(tenantId, "Leadership");

        var skills = new[]
        {
            Skill.Create(tenantId, "Software engineering", null, technical.Id),
            Skill.Create(tenantId, "Data analysis", null, technical.Id),
            Skill.Create(tenantId, "Stakeholder communication", null, behavioral.Id),
            Skill.Create(tenantId, "Adaptability", null, behavioral.Id),
            Skill.Create(tenantId, "Team development", null, leadership.Id),
            Skill.Create(tenantId, "Strategic thinking", null, leadership.Id)
        };

        // Sensible expected levels across the five-level scale (Proficient-centered, 1-based ordinals).
        var expectedLevels = new[] { 3, 3, 4, 3, 3, 4 };

        var set = SkillExpectationSet.CreateDraft(
            tenantId,
            DefaultSetName,
            "A starting set of expected proficiencies across core capabilities.",
            scale.Id);
        for (var index = 0; index < skills.Length; index++)
            set.AddItem(skills[index].Id, expectedLevels[index], scale);
        set.Activate(scale);

        return new TenantSkillConfigurationDefaults(
            [technical, behavioral, leadership],
            skills,
            scale,
            set);
    }
}

public sealed record TenantSkillConfigurationDefaults(
    IReadOnlyList<SkillCategory> Categories,
    IReadOnlyList<Skill> Skills,
    ProficiencyScale ProficiencyScale,
    SkillExpectationSet ExpectationSet);
