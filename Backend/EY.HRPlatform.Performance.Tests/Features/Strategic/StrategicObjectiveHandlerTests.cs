using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Strategic.Commands;
using EY.HRPlatform.Performance.Features.Strategic.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Strategic;

/// <summary>Handler tests for strategic create / publish / list commands (D-03, D-05, D-14, D-15).</summary>
public class StrategicObjectiveHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static IHttpContextAccessor BuildHttpContextAccessor(System.Security.Claims.ClaimsPrincipal user)
    {
        var ctx = new DefaultHttpContext { User = user };
        return new FakeHttpContextAccessor(ctx);
    }

    private sealed class FakeHttpContextAccessor(HttpContext context) : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get; set; } = context;
    }

    private static (Guid PeriodId, Guid ObjectiveId) SeedDraftObjective(
        string dbName, TenantContext tc, string orgScope = "Company", string title = "Drive Growth")
    {
        using var seed = PerformanceTestContext.Create(tc, dbName);

        var period = StrategicPeriod.Create(
            TenantId, "FY2026", 2026, PeriodGranularity.Annual,
            new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc));
        seed.StrategicPeriods.Add(period);

        var obj = StrategicObjective.Create(TenantId, period.Id, orgScope, title, null);
        seed.StrategicObjectives.Add(obj);
        seed.SaveChanges();

        return (period.Id, obj.Id);
    }

    private static TenantContext BuildTenantContext()
    {
        var tc = new TenantContext();
        tc.SetTenant(TenantId);
        return tc;
    }

    private static System.Security.Claims.ClaimsPrincipal UserWithPublishPermission()
        => new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.StrategicPublish, PermissionScopes.Tenant)
            .Build();

    private static System.Security.Claims.ClaimsPrincipal UserWithManagePermission()
        => new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.StrategicManage, PermissionScopes.Tenant)
            .Build();

    private static System.Security.Claims.ClaimsPrincipal UserWithViewPermission()
        => new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.StrategicView, PermissionScopes.Tenant)
            .Build();

    // ─── CreateStrategicObjectiveCommand ──────────────────────────────────────

    [Fact]
    public async Task Create_WithoutManagePermission_ReturnsForbidden()
    {
        var dbName = $"strategic-create-forbidden-{Guid.NewGuid()}";
        var tc = BuildTenantContext();

        await using var db = PerformanceTestContext.Create(tc, dbName);
        var handler = new CreateStrategicObjectiveCommandHandler(
            db, tc,
            new PerformanceAccessPolicyService(),
            BuildHttpContextAccessor(ClaimsPrincipalBuilder.Anonymous()));

        var result = await handler.Handle(
            new CreateStrategicObjectiveCommand(Guid.NewGuid(), "Company", "Title", null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Create_WithManagePermission_WhenPeriodMissing_ReturnsNotFound()
    {
        var dbName = $"strategic-create-notfound-{Guid.NewGuid()}";
        var tc = BuildTenantContext();

        await using var db = PerformanceTestContext.Create(tc, dbName);
        var handler = new CreateStrategicObjectiveCommandHandler(
            db, tc,
            new PerformanceAccessPolicyService(),
            BuildHttpContextAccessor(UserWithManagePermission()));

        var result = await handler.Handle(
            new CreateStrategicObjectiveCommand(Guid.NewGuid(), "Company", "Title", null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Create_WithManagePermission_AndExistingPeriod_ReturnsId()
    {
        var dbName = $"strategic-create-ok-{Guid.NewGuid()}";
        var tc = BuildTenantContext();
        var (periodId, _) = SeedDraftObjective(dbName, tc);

        await using var db = PerformanceTestContext.Create(tc, dbName);
        var handler = new CreateStrategicObjectiveCommandHandler(
            db, tc,
            new PerformanceAccessPolicyService(),
            BuildHttpContextAccessor(UserWithManagePermission()));

        var result = await handler.Handle(
            new CreateStrategicObjectiveCommand(periodId, "Company", "New objective", null),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotEqual(Guid.Empty, result.Value);
    }

    // ─── PublishStrategicObjectiveCommand ─────────────────────────────────────

    [Fact]
    public async Task Publish_WithoutPublishPermission_ReturnsForbidden()
    {
        var dbName = $"strategic-publish-forbidden-{Guid.NewGuid()}";
        var tc = BuildTenantContext();
        var (_, objectiveId) = SeedDraftObjective(dbName, tc);

        await using var db = PerformanceTestContext.Create(tc, dbName);
        var handler = new PublishStrategicObjectiveCommandHandler(
            db,
            new StubCurrentUserContext(),
            new PerformanceAccessPolicyService(),
            BuildHttpContextAccessor(ClaimsPrincipalBuilder.Anonymous()));

        var result = await handler.Handle(
            new PublishStrategicObjectiveCommand(objectiveId, 0),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Publish_WhenObjectiveNotFound_ReturnsNotFound()
    {
        var dbName = $"strategic-publish-notfound-{Guid.NewGuid()}";
        var tc = BuildTenantContext();

        await using var db = PerformanceTestContext.Create(tc, dbName);
        var handler = new PublishStrategicObjectiveCommandHandler(
            db,
            new StubCurrentUserContext(),
            new PerformanceAccessPolicyService(),
            BuildHttpContextAccessor(UserWithPublishPermission()));

        var result = await handler.Handle(
            new PublishStrategicObjectiveCommand(Guid.NewGuid(), 0),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Publish_DraftObjective_SetsPublishedStatusAndEmitsAudit()
    {
        var dbName = $"strategic-publish-ok-{Guid.NewGuid()}";
        var tc = BuildTenantContext();
        var (_, objectiveId) = SeedDraftObjective(dbName, tc);

        // Get version from seed
        uint version;
        {
            using var seed = PerformanceTestContext.Create(tc, dbName);
            version = (await seed.StrategicObjectives.FindAsync(objectiveId))!.Version;
        }

        await using var db = PerformanceTestContext.Create(tc, dbName);
        var handler = new PublishStrategicObjectiveCommandHandler(
            db,
            new StubCurrentUserContext(),
            new PerformanceAccessPolicyService(),
            BuildHttpContextAccessor(UserWithPublishPermission()));

        var result = await handler.Handle(
            new PublishStrategicObjectiveCommand(objectiveId, version),
            CancellationToken.None);

        Assert.True(result.IsSuccess);

        await using var verify = PerformanceTestContext.Create(tc, dbName);
        var published = await verify.StrategicObjectives.FindAsync(objectiveId);
        Assert.NotNull(published);
        Assert.Equal(StrategicObjectiveStatus.Published, published!.Status);
        Assert.NotNull(published.PublishedAt);
        Assert.Equal(1, published.VersionNumber);

        // D-14/T-03-08: audit event emitted
        var audit = await verify.PerformanceCycleAuditEvents
            .FirstOrDefaultAsync(a => a.Action == PerformanceCycleAuditAction.StrategicObjectivePublished);
        Assert.NotNull(audit);
    }

    [Fact]
    public async Task Publish_WhenAlreadyPublishedVersionExists_SupersedesPriorAndCreatesOneCurrentPublished()
    {
        // D-03: exactly one Published version per tenant+scope+period after republish
        var dbName = $"strategic-supersede-{Guid.NewGuid()}";
        var tc = BuildTenantContext();
        var (periodId, firstObjectiveId) = SeedDraftObjective(dbName, tc, "Company", "Version 1 objective");

        // Publish the first version
        uint firstVersion;
        {
            using var seed = PerformanceTestContext.Create(tc, dbName);
            firstVersion = (await seed.StrategicObjectives.FindAsync(firstObjectiveId))!.Version;
        }

        await using (var db1 = PerformanceTestContext.Create(tc, dbName))
        {
            var handler1 = new PublishStrategicObjectiveCommandHandler(
                db1, new StubCurrentUserContext(), new PerformanceAccessPolicyService(),
                BuildHttpContextAccessor(UserWithPublishPermission()));
            var r1 = await handler1.Handle(new PublishStrategicObjectiveCommand(firstObjectiveId, firstVersion), CancellationToken.None);
            Assert.True(r1.IsSuccess);
        }

        // Create a second draft in the SAME scope+period
        Guid secondObjectiveId;
        {
            using var seed2 = PerformanceTestContext.Create(tc, dbName);
            var obj2 = StrategicObjective.Create(TenantId, periodId, "Company", "Version 2 objective", null);
            seed2.StrategicObjectives.Add(obj2);
            seed2.SaveChanges();
            secondObjectiveId = obj2.Id;
        }

        // Publish the second version — should supersede the first
        uint secondVersion;
        {
            using var seedV = PerformanceTestContext.Create(tc, dbName);
            secondVersion = (await seedV.StrategicObjectives.FindAsync(secondObjectiveId))!.Version;
        }

        await using var db2 = PerformanceTestContext.Create(tc, dbName);
        var handler2 = new PublishStrategicObjectiveCommandHandler(
            db2, new StubCurrentUserContext(), new PerformanceAccessPolicyService(),
            BuildHttpContextAccessor(UserWithPublishPermission()));
        var r2 = await handler2.Handle(new PublishStrategicObjectiveCommand(secondObjectiveId, secondVersion), CancellationToken.None);
        Assert.True(r2.IsSuccess);

        // Verify: exactly one Published in this scope+period; prior is Superseded
        await using var verify = PerformanceTestContext.Create(tc, dbName);
        var allObjectives = await verify.StrategicObjectives
            .IgnoreQueryFilters()  // bypass tenant filter to see all
            .Where(o => o.PeriodId == periodId && o.OrgScope == "Company" && o.TenantId == TenantId)
            .ToListAsync();

        var publishedCount = allObjectives.Count(o => o.Status == StrategicObjectiveStatus.Published);
        var supersededCount = allObjectives.Count(o => o.Status == StrategicObjectiveStatus.Superseded);

        Assert.Equal(1, publishedCount);
        Assert.Equal(1, supersededCount);

        // The new published version has VersionNumber=2
        var currentPublished = allObjectives.Single(o => o.Status == StrategicObjectiveStatus.Published);
        Assert.Equal(2, currentPublished.VersionNumber);
        Assert.Equal(secondObjectiveId, currentPublished.Id);

        // The superseded version points to the new one
        var superseded = allObjectives.Single(o => o.Status == StrategicObjectiveStatus.Superseded);
        Assert.Equal(firstObjectiveId, superseded.Id);
        Assert.Equal(secondObjectiveId, superseded.SupersededById);

        // Two audit events: one StrategicObjectivePublished + one StrategicObjectiveSuperseded
        var auditEvents = await verify.PerformanceCycleAuditEvents
            .IgnoreQueryFilters()
            .Where(a => a.TenantId == TenantId)
            .ToListAsync();

        Assert.Contains(auditEvents, a => a.Action == PerformanceCycleAuditAction.StrategicObjectivePublished);
        Assert.Contains(auditEvents, a => a.Action == PerformanceCycleAuditAction.StrategicObjectiveSuperseded);

        // Superseded audit points to the old objective
        var supersededAudit = auditEvents.Single(a => a.Action == PerformanceCycleAuditAction.StrategicObjectiveSuperseded);
        Assert.Equal(firstObjectiveId, supersededAudit.CycleId);
    }

    [Fact]
    public async Task Publish_AlreadyPublished_ReturnsConflict()
    {
        var dbName = $"strategic-double-publish-{Guid.NewGuid()}";
        var tc = BuildTenantContext();
        var (_, objectiveId) = SeedDraftObjective(dbName, tc);

        uint version;
        {
            using var seed = PerformanceTestContext.Create(tc, dbName);
            version = (await seed.StrategicObjectives.FindAsync(objectiveId))!.Version;
        }

        // First publish
        await using (var db1 = PerformanceTestContext.Create(tc, dbName))
        {
            var h1 = new PublishStrategicObjectiveCommandHandler(
                db1, new StubCurrentUserContext(), new PerformanceAccessPolicyService(),
                BuildHttpContextAccessor(UserWithPublishPermission()));
            var r1 = await h1.Handle(new PublishStrategicObjectiveCommand(objectiveId, version), CancellationToken.None);
            Assert.True(r1.IsSuccess);
        }

        // Get new version post-publish
        uint postPublishVersion;
        {
            using var seed2 = PerformanceTestContext.Create(tc, dbName);
            postPublishVersion = (await seed2.StrategicObjectives.FindAsync(objectiveId))!.Version;
        }

        // Attempt to publish the same already-Published objective again — should conflict
        await using var db2 = PerformanceTestContext.Create(tc, dbName);
        var h2 = new PublishStrategicObjectiveCommandHandler(
            db2, new StubCurrentUserContext(), new PerformanceAccessPolicyService(),
            BuildHttpContextAccessor(UserWithPublishPermission()));
        var r2 = await h2.Handle(new PublishStrategicObjectiveCommand(objectiveId, postPublishVersion), CancellationToken.None);

        Assert.True(r2.IsFailure);
        Assert.Contains("Conflict", r2.Error.Code, StringComparison.OrdinalIgnoreCase);
    }

    // ─── GetStrategicObjectivesQuery ──────────────────────────────────────────

    [Fact]
    public async Task GetAll_WithoutViewPermission_ReturnsForbidden()
    {
        var dbName = $"strategic-get-forbidden-{Guid.NewGuid()}";
        var tc = BuildTenantContext();

        await using var db = PerformanceTestContext.Create(tc, dbName);
        var handler = new GetStrategicObjectivesQueryHandler(
            db,
            new PerformanceAccessPolicyService(),
            BuildHttpContextAccessor(ClaimsPrincipalBuilder.Anonymous()));

        var result = await handler.Handle(new GetStrategicObjectivesQuery(), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetAll_WithViewPermission_IncludesSupersededVersions()
    {
        // D-03: superseded versions remain readable to authorized users
        var dbName = $"strategic-get-superseded-{Guid.NewGuid()}";
        var tc = BuildTenantContext();
        var (periodId, firstId) = SeedDraftObjective(dbName, tc, "Company", "V1");

        // Publish first
        uint v1;
        {
            using var s = PerformanceTestContext.Create(tc, dbName);
            v1 = (await s.StrategicObjectives.FindAsync(firstId))!.Version;
        }
        await using (var db1 = PerformanceTestContext.Create(tc, dbName))
        {
            var h = new PublishStrategicObjectiveCommandHandler(
                db1, new StubCurrentUserContext(), new PerformanceAccessPolicyService(),
                BuildHttpContextAccessor(UserWithPublishPermission()));
            await h.Handle(new PublishStrategicObjectiveCommand(firstId, v1), CancellationToken.None);
        }

        // Create and publish second (supersedes first)
        Guid secondId;
        {
            using var s2 = PerformanceTestContext.Create(tc, dbName);
            var obj2 = StrategicObjective.Create(TenantId, periodId, "Company", "V2", null);
            s2.StrategicObjectives.Add(obj2);
            s2.SaveChanges();
            secondId = obj2.Id;
        }
        uint v2;
        {
            using var s3 = PerformanceTestContext.Create(tc, dbName);
            v2 = (await s3.StrategicObjectives.FindAsync(secondId))!.Version;
        }
        await using (var db2 = PerformanceTestContext.Create(tc, dbName))
        {
            var h2 = new PublishStrategicObjectiveCommandHandler(
                db2, new StubCurrentUserContext(), new PerformanceAccessPolicyService(),
                BuildHttpContextAccessor(UserWithPublishPermission()));
            await h2.Handle(new PublishStrategicObjectiveCommand(secondId, v2), CancellationToken.None);
        }

        // Query — should return both published and superseded
        await using var verifyDb = PerformanceTestContext.Create(tc, dbName);
        var queryHandler = new GetStrategicObjectivesQueryHandler(
            verifyDb,
            new PerformanceAccessPolicyService(),
            BuildHttpContextAccessor(UserWithViewPermission()));

        var result = await queryHandler.Handle(new GetStrategicObjectivesQuery(periodId, "Company"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Count);
        Assert.Contains(result.Value, o => o.Status == "Published");
        Assert.Contains(result.Value, o => o.Status == "Superseded");
    }
}
