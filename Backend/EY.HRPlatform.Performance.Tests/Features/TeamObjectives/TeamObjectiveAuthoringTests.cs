using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.TeamObjectives.Commands;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.TeamObjectives;

public class TeamObjectiveAuthoringTests
{
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime End = new(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc);

    private sealed record Seeded(
        Guid TenantId,
        string DbName,
        Guid CycleId,
        Guid ActiveStrategicId,
        Guid ManagerEmployeeId,
        Guid OtherManagerEmployeeId);

    /// <summary>Seeds a launched campaign whose frozen baseline names two distinct approvers.</summary>
    private static async Task<Seeded> SeedLaunchedAsync(bool launch = true)
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"team-objectives-{Guid.NewGuid()}";
        var managerId = Guid.NewGuid();
        var otherManagerId = Guid.NewGuid();

        await using var seed = PerformanceTestContext.Create(tenantId, out _, dbName);
        var cycle = TestCycles.Create(tenantId, "FY26 Cascade", PerformanceCycleType.Annual, Start, End);
        var strategic = cycle.AddStrategicObjective("Improve client delivery", "Raise quality", "Consulting");

        if (launch)
        {
            cycle.Launch(
                [
                    new ResolvedLaunchParticipant(Guid.NewGuid(), "Alice", managerId, "Mia Manager", false, null,
                        OrgUnitName: "Consulting"),
                    new ResolvedLaunchParticipant(Guid.NewGuid(), "Bob", otherManagerId, "Omar Lead", false, null,
                        OrgUnitName: "Audit")
                ],
                Start.AddDays(1));
        }

        seed.PerformanceCycles.Add(cycle);
        await seed.SaveChangesAsync();
        return new Seeded(tenantId, dbName, cycle.Id, strategic.Id, managerId, otherManagerId);
    }

    private static CreateTeamObjectiveCommand ValidCreate(Seeded seeded, string title = "Raise delivery NPS")
        => new(seeded.CycleId, seeded.ActiveStrategicId, title, "NPS above 60 by Q4", "Quantitative", null);

    [Fact]
    public async Task Create_ByResponsibleManager_SavesOwnedObjectiveAndAudits()
    {
        var seeded = await SeedLaunchedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var handler = new CreateTeamObjectiveCommandHandler(
            db, new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId, FullName = "Mia Manager" });

        var result = await handler.Handle(ValidCreate(seeded), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(seeded.ManagerEmployeeId, result.Value.OwnerManagerEmployeeId);
        Assert.Equal("Raise delivery NPS", result.Value.Title);
        Assert.Equal("Quantitative", result.Value.MeasurementMethod);
        Assert.Equal("Improve client delivery", result.Value.StrategicObjectiveTitle);

        var audit = await db.PerformanceCycleAuditEvents.SingleAsync(
            e => e.Action == PerformanceCycleAuditAction.TeamObjectiveCreated);
        Assert.Equal(seeded.CycleId, audit.CycleId);
        Assert.Contains("Raise delivery NPS", audit.Details);
    }

    [Fact]
    public async Task Create_WithoutEmployeeContext_IsForbidden()
    {
        var seeded = await SeedLaunchedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var handler = new CreateTeamObjectiveCommandHandler(db, new StubCurrentUserContext { EmployeeId = null });

        var result = await handler.Handle(ValidCreate(seeded), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("TeamObjective.EmployeeContextForbidden", result.Error.Code);
    }

    [Fact]
    public async Task Create_WithPermissionButNoFrozenResponsibility_IsForbidden()
    {
        var seeded = await SeedLaunchedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var handler = new CreateTeamObjectiveCommandHandler(
            db, new StubCurrentUserContext { EmployeeId = Guid.NewGuid() });

        var result = await handler.Handle(ValidCreate(seeded), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("TeamObjective.NotResponsibleForbidden", result.Error.Code);
    }

    [Fact]
    public async Task Create_OnDraftCampaign_IsRejectedAsNotLaunched()
    {
        var seeded = await SeedLaunchedAsync(launch: false);
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var handler = new CreateTeamObjectiveCommandHandler(
            db, new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId });

        var result = await handler.Handle(ValidCreate(seeded), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("TeamObjective.NotLaunchedInvalid", result.Error.Code);
    }

    [Fact]
    public async Task Create_WithStrategicObjectiveOfAnotherCampaign_FailsValidation()
    {
        var seeded = await SeedLaunchedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var handler = new CreateTeamObjectiveCommandHandler(
            db, new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId });

        var result = await handler.Handle(
            ValidCreate(seeded) with { StrategicObjectiveId = Guid.NewGuid() }, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("TeamObjective.StrategicLinkInvalid", result.Error.Code);
    }

    [Fact]
    public async Task Create_WithDisabledMeasurementMethod_FailsValidation()
    {
        var seeded = await SeedLaunchedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var handler = new CreateTeamObjectiveCommandHandler(
            db, new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId });

        var result = await handler.Handle(
            ValidCreate(seeded) with { MeasurementMethod = "Milestones" }, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("TeamObjective.Invalid", result.Error.Code);
        Assert.Contains("Milestones", result.Error.Message);
    }

    [Fact]
    public async Task Create_WithMissingTitle_FailsValidationAndNamesField()
    {
        var seeded = await SeedLaunchedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var handler = new CreateTeamObjectiveCommandHandler(
            db, new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId });

        var result = await handler.Handle(ValidCreate(seeded, title: " "), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("TeamObjective.Invalid", result.Error.Code);
        Assert.Contains("title", result.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<Guid> CreateObjectiveAsync(Seeded seeded, Guid ownerEmployeeId, string ownerName = "Mia Manager")
    {
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var handler = new CreateTeamObjectiveCommandHandler(
            db, new StubCurrentUserContext { EmployeeId = ownerEmployeeId, FullName = ownerName });
        var result = await handler.Handle(ValidCreate(seeded), CancellationToken.None);
        Assert.True(result.IsSuccess);
        return result.Value.Id;
    }

    [Fact]
    public async Task Update_ByOwner_AppliesChangesAndAuditsChangedFields()
    {
        var seeded = await SeedLaunchedAsync();
        var objectiveId = await CreateObjectiveAsync(seeded, seeded.ManagerEmployeeId);

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var current = await db.CampaignTeamObjectives.AsNoTracking().SingleAsync(o => o.Id == objectiveId);
        var handler = new UpdateTeamObjectiveCommandHandler(
            db, new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId });

        var result = await handler.Handle(new UpdateTeamObjectiveCommand(
            seeded.CycleId, objectiveId, current.Version,
            seeded.ActiveStrategicId, "Improve retention", "Attrition under 8%", "Qualitative", "Team focus"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Improve retention", result.Value.Title);
        Assert.Equal("Qualitative", result.Value.MeasurementMethod);

        var audit = await db.PerformanceCycleAuditEvents.SingleAsync(
            e => e.Action == PerformanceCycleAuditAction.TeamObjectiveUpdated);
        Assert.Contains("title", audit.Details);
        Assert.Contains("measurement method", audit.Details);
    }

    [Fact]
    public async Task Update_ByNonOwner_IsForbidden()
    {
        var seeded = await SeedLaunchedAsync();
        var objectiveId = await CreateObjectiveAsync(seeded, seeded.ManagerEmployeeId);

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var current = await db.CampaignTeamObjectives.AsNoTracking().SingleAsync(o => o.Id == objectiveId);
        var handler = new UpdateTeamObjectiveCommandHandler(
            db, new StubCurrentUserContext { EmployeeId = seeded.OtherManagerEmployeeId });

        var result = await handler.Handle(new UpdateTeamObjectiveCommand(
            seeded.CycleId, objectiveId, current.Version,
            seeded.ActiveStrategicId, "Hijacked", "Changed", "Quantitative", null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("TeamObjective.NotOwnerForbidden", result.Error.Code);
        var unchanged = await db.CampaignTeamObjectives.AsNoTracking().SingleAsync(o => o.Id == objectiveId);
        Assert.Equal("Raise delivery NPS", unchanged.Title);
    }

    [Fact]
    public async Task Update_WithStaleVersion_ThrowsConcurrency()
    {
        var seeded = await SeedLaunchedAsync();
        var objectiveId = await CreateObjectiveAsync(seeded, seeded.ManagerEmployeeId);

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var current = await db.CampaignTeamObjectives.AsNoTracking().SingleAsync(o => o.Id == objectiveId);
        var handler = new UpdateTeamObjectiveCommandHandler(
            db, new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId });

        await Assert.ThrowsAsync<ConcurrencyException>(() => handler.Handle(new UpdateTeamObjectiveCommand(
            seeded.CycleId, objectiveId, current.Version + 1,
            seeded.ActiveStrategicId, "Improve retention", "Attrition under 8%", "Quantitative", null),
            CancellationToken.None));
    }

    [Fact]
    public async Task Delete_ByOwner_RemovesAndAudits()
    {
        var seeded = await SeedLaunchedAsync();
        var objectiveId = await CreateObjectiveAsync(seeded, seeded.ManagerEmployeeId);

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var current = await db.CampaignTeamObjectives.AsNoTracking().SingleAsync(o => o.Id == objectiveId);
        var handler = new DeleteTeamObjectiveCommandHandler(
            db, new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId });

        var result = await handler.Handle(
            new DeleteTeamObjectiveCommand(seeded.CycleId, objectiveId, current.Version), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(await db.CampaignTeamObjectives.AnyAsync(o => o.Id == objectiveId));
        Assert.True(await db.PerformanceCycleAuditEvents.AnyAsync(
            e => e.Action == PerformanceCycleAuditAction.TeamObjectiveDeleted));
    }

    [Fact]
    public async Task Delete_ByNonOwner_IsForbidden()
    {
        var seeded = await SeedLaunchedAsync();
        var objectiveId = await CreateObjectiveAsync(seeded, seeded.ManagerEmployeeId);

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var current = await db.CampaignTeamObjectives.AsNoTracking().SingleAsync(o => o.Id == objectiveId);
        var handler = new DeleteTeamObjectiveCommandHandler(
            db, new StubCurrentUserContext { EmployeeId = seeded.OtherManagerEmployeeId });

        var result = await handler.Handle(
            new DeleteTeamObjectiveCommand(seeded.CycleId, objectiveId, current.Version), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("TeamObjective.NotOwnerForbidden", result.Error.Code);
        Assert.True(await db.CampaignTeamObjectives.AnyAsync(o => o.Id == objectiveId));
    }

    [Fact]
    public async Task CrossTenant_MutationAnswersNotFound()
    {
        var seeded = await SeedLaunchedAsync();
        var objectiveId = await CreateObjectiveAsync(seeded, seeded.ManagerEmployeeId);

        // Same database, different acting tenant: the global filter hides the objective.
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _, seeded.DbName);
        var handler = new UpdateTeamObjectiveCommandHandler(
            db, new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId });

        var result = await handler.Handle(new UpdateTeamObjectiveCommand(
            seeded.CycleId, objectiveId, 0,
            seeded.ActiveStrategicId, "Cross-tenant", "Changed", "Quantitative", null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }
}
