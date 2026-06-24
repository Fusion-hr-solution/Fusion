using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class StrategicObjectiveTests
{
    private static readonly Guid ValidTenantId = Guid.NewGuid();
    private static readonly Guid ValidPeriodId = Guid.NewGuid();
    private const string ValidScope = "Company";
    private const string ValidTitle = "Drive digital transformation";

    // ─── Create ───────────────────────────────────────────────────────────────

    [Fact]
    public void Create_WithEmptyTenantId_ThrowsArgumentException()
    {
        var ex = Assert.Throws<ArgumentException>(() =>
            StrategicObjective.Create(Guid.Empty, ValidPeriodId, ValidScope, ValidTitle, null));
        Assert.Contains("required", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Create_WithEmptyPeriodId_ThrowsArgumentException()
    {
        var ex = Assert.Throws<ArgumentException>(() =>
            StrategicObjective.Create(ValidTenantId, Guid.Empty, ValidScope, ValidTitle, null));
        Assert.Contains("required", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Create_WithBlankTitle_ThrowsArgumentException()
    {
        var ex = Assert.Throws<ArgumentException>(() =>
            StrategicObjective.Create(ValidTenantId, ValidPeriodId, ValidScope, "   ", null));
        Assert.Contains("title", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Create_ValidInputs_StartsInDraftWithVersionOne()
    {
        var objective = StrategicObjective.Create(ValidTenantId, ValidPeriodId, ValidScope, ValidTitle, null);

        Assert.Equal(StrategicObjectiveStatus.Draft, objective.Status);
        Assert.Equal(1, objective.VersionNumber);
        Assert.Equal(ValidTenantId, objective.TenantId);
        Assert.Equal(ValidPeriodId, objective.PeriodId);
        Assert.Equal(ValidScope, objective.OrgScope);
        Assert.Equal(ValidTitle, objective.Title);
        Assert.Null(objective.PublishedAt);
        Assert.Null(objective.SupersededById);
    }

    // ─── Publish ──────────────────────────────────────────────────────────────

    [Fact]
    public void Publish_FromDraft_SetsPublishedStatusAndTimestamp()
    {
        var objective = StrategicObjective.Create(ValidTenantId, ValidPeriodId, ValidScope, ValidTitle, null);
        var now = DateTime.UtcNow;

        objective.Publish(now);

        Assert.Equal(StrategicObjectiveStatus.Published, objective.Status);
        Assert.NotNull(objective.PublishedAt);
        Assert.Equal(DateTimeKind.Utc, objective.PublishedAt!.Value.Kind);
    }

    [Fact]
    public void Publish_FromNonDraft_ThrowsDomainRuleViolation()
    {
        var objective = StrategicObjective.Create(ValidTenantId, ValidPeriodId, ValidScope, ValidTitle, null);
        objective.Publish(DateTime.UtcNow);

        // Already Published — second publish must throw
        Assert.Throws<DomainRuleViolationException>(() => objective.Publish(DateTime.UtcNow));
    }

    [Fact]
    public void Publish_FromSuperseded_ThrowsDomainRuleViolation()
    {
        var objective = StrategicObjective.Create(ValidTenantId, ValidPeriodId, ValidScope, ValidTitle, null);
        objective.Publish(DateTime.UtcNow);
        objective.Supersede(Guid.NewGuid(), DateTime.UtcNow);

        Assert.Throws<DomainRuleViolationException>(() => objective.Publish(DateTime.UtcNow));
    }

    // ─── Supersede ────────────────────────────────────────────────────────────

    [Fact]
    public void Supersede_FromPublished_SetsSupersededStatusAndReplacerId()
    {
        var objective = StrategicObjective.Create(ValidTenantId, ValidPeriodId, ValidScope, ValidTitle, null);
        objective.Publish(DateTime.UtcNow);
        var replacer = Guid.NewGuid();

        objective.Supersede(replacer, DateTime.UtcNow);

        Assert.Equal(StrategicObjectiveStatus.Superseded, objective.Status);
        Assert.Equal(replacer, objective.SupersededById);
    }

    [Fact]
    public void Supersede_FromDraft_ThrowsDomainRuleViolation()
    {
        var objective = StrategicObjective.Create(ValidTenantId, ValidPeriodId, ValidScope, ValidTitle, null);

        Assert.Throws<DomainRuleViolationException>(() => objective.Supersede(Guid.NewGuid(), DateTime.UtcNow));
    }

    [Fact]
    public void Supersede_FromAlreadySuperseded_ThrowsDomainRuleViolation()
    {
        var objective = StrategicObjective.Create(ValidTenantId, ValidPeriodId, ValidScope, ValidTitle, null);
        objective.Publish(DateTime.UtcNow);
        objective.Supersede(Guid.NewGuid(), DateTime.UtcNow);

        Assert.Throws<DomainRuleViolationException>(() => objective.Supersede(Guid.NewGuid(), DateTime.UtcNow));
    }

    // ─── No CycleId member ────────────────────────────────────────────────────

    [Fact]
    public void StrategicObjective_HasNoCycleIdMember()
    {
        // D-01 prohibition: StrategicObjective must not reference CycleId
        var type = typeof(StrategicObjective);
        var cycleIdProp = type.GetProperty("CycleId");
        Assert.Null(cycleIdProp);
    }
}

public class StrategicPeriodTests
{
    [Fact]
    public void Create_EndDateBeforeStartDate_ThrowsArgumentException()
    {
        var start = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        Assert.Throws<ArgumentException>(() =>
            StrategicPeriod.Create(Guid.NewGuid(), "FY2026", 2026, PeriodGranularity.Annual, start, end));
    }

    [Fact]
    public void Create_ValidInputs_NormalizesToUtc()
    {
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Unspecified);
        var end = new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Unspecified);

        var period = StrategicPeriod.Create(Guid.NewGuid(), "FY2026", 2026, PeriodGranularity.Annual, start, end);

        Assert.Equal(DateTimeKind.Utc, period.StartDate.Kind);
        Assert.Equal(DateTimeKind.Utc, period.EndDate.Kind);
        Assert.Equal(PeriodGranularity.Annual, period.Granularity);
    }

    [Fact]
    public void Create_WithEmptyTenantId_ThrowsArgumentException()
    {
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc);

        Assert.Throws<ArgumentException>(() =>
            StrategicPeriod.Create(Guid.Empty, "FY2026", 2026, PeriodGranularity.Annual, start, end));
    }
}
