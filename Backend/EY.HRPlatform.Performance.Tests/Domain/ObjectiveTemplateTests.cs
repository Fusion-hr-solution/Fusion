using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class ObjectiveTemplateTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public void Create_DefaultsToActive()
    {
        var template = ObjectiveTemplate.Create(TenantId, "Grow revenue", category: "Business");

        Assert.Equal(ObjectiveTemplateStatus.Active, template.Status);
        Assert.Equal("Grow revenue", template.Name);
        Assert.Equal("Business", template.Category);
    }

    [Fact]
    public void Create_WithWeightOutOfRange_Throws()
    {
        Assert.Throws<ArgumentException>(() => ObjectiveTemplate.Create(TenantId, "X", defaultWeight: 150));
    }

    [Fact]
    public void Archive_ThenArchiveAgain_Throws()
    {
        var template = ObjectiveTemplate.Create(TenantId, "X");
        template.Archive();

        Assert.Equal(ObjectiveTemplateStatus.Archived, template.Status);
        Assert.Throws<DomainRuleViolationException>(template.Archive);
    }

    [Fact]
    public void Restore_FromArchived_Works()
    {
        var template = ObjectiveTemplate.Create(TenantId, "X");
        template.Archive();
        template.Restore();

        Assert.Equal(ObjectiveTemplateStatus.Active, template.Status);
    }

    [Fact]
    public void Create_WithSmartDefinition_IsReadyForPlanning()
    {
        var template = ObjectiveTemplate.Create(
            TenantId,
            "Increase renewal rate",
            successMeasure: "Renewal rate",
            target: "At least 92% by the end of the cycle",
            level: ObjectiveTemplateLevel.Team);

        Assert.True(template.IsReadyForPlanning);
        Assert.Equal(ObjectiveTemplateLevel.Team, template.Level);
    }

    [Fact]
    public void Create_LegacyDefinition_RequiresEnrichmentBeforePlanning()
    {
        var template = ObjectiveTemplate.Create(TenantId, "Legacy objective");

        Assert.False(template.IsReadyForPlanning);
    }
}
