using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.Attachments;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Performance.Tests.Features.Attachments;

public sealed class AttachmentOwnerAuthorizationTests
{
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Upload_ExistingCycleWithManagePermission_IsAllowed()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = CreateCycle(tenantId);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.CycleManage, PermissionScopes.Tenant)
            .Build();

        var authorized = await CreateSut(db).CanUploadAsync(
            AttachmentOwnerAuthorization.PerformanceCycleOwnerType,
            cycle.Id,
            user,
            CancellationToken.None);

        Assert.True(authorized);
    }

    [Fact]
    public async Task Download_ExistingCycleWithViewPermission_IsAllowed()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = CreateCycle(tenantId);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.CycleView, PermissionScopes.Tenant)
            .Build();

        var authorized = await CreateSut(db).CanDownloadAsync(
            AttachmentOwnerAuthorization.PerformanceCycleOwnerType,
            cycle.Id,
            user,
            CancellationToken.None);

        Assert.True(authorized);
    }

    [Theory]
    [InlineData("EmployeeObjectivePlan")]
    [InlineData("")]
    public async Task UnknownOwnerType_IsDenied(string ownerType)
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.CycleManage, PermissionScopes.Tenant)
            .Build();

        var authorized = await CreateSut(db).CanUploadAsync(
            ownerType,
            Guid.NewGuid(),
            user,
            CancellationToken.None);

        Assert.False(authorized);
    }

    [Fact]
    public async Task MissingOrForeignCycle_IsDenied()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.CycleManage, PermissionScopes.Tenant)
            .Build();

        var authorized = await CreateSut(db).CanUploadAsync(
            AttachmentOwnerAuthorization.PerformanceCycleOwnerType,
            Guid.NewGuid(),
            user,
            CancellationToken.None);

        Assert.False(authorized);
    }

    [Fact]
    public async Task ExistingCycleWithoutPermission_IsDenied()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = CreateCycle(tenantId);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();

        var authorized = await CreateSut(db).CanDownloadAsync(
            AttachmentOwnerAuthorization.PerformanceCycleOwnerType,
            cycle.Id,
            ClaimsPrincipalBuilder.Anonymous(),
            CancellationToken.None);

        Assert.False(authorized);
    }

    private static AttachmentOwnerAuthorization CreateSut(
        PerformanceDbContext db,
        ICurrentUserContext? currentUser = null)
        => new(
            db,
            new PerformanceAccessPolicyService(),
            currentUser ?? new StubCurrentUserContext(),
            new EffectiveReviewerResolver(db));

    private static PerformanceCycle CreateCycle(Guid tenantId)
        => PerformanceCycle.CreateDraft(
            tenantId,
            "FY26 attachment proof",
            $"fy26-attachment-{Guid.NewGuid():N}",
            2026,
            null,
            Guid.NewGuid(),
            "HR Admin",
            Start,
            Start.AddDays(14),
            Start.AddDays(21),
            Start.AddDays(30),
            CampaignPlanningRulesSnapshot.Capture(
                5,
                "[25,50,75,100]",
                "Quantitative,Qualitative",
                Guid.NewGuid(),
                Start));
}
