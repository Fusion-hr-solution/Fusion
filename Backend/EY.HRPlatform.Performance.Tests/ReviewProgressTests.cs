using System.Net;
using System.Text.Json;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using static EY.HRPlatform.Performance.Tests.TestHelpers.ReviewWorld;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>Review progress for Core HR's org chart lens (B-131): the review read rule, keyed by Core's stable key.</summary>
public sealed class ReviewProgressTests
{
    private const string Path = "/api/performance/reviews/progress";

    private static async Task<Dictionary<string, JsonElement>> ProgressAsync(HttpClient client)
        => (await Data(await client.GetAsync(Path))).GetProperty("people").EnumerateArray()
            .ToDictionary(person => person.GetProperty("employeeKey").GetString()!);

    [Fact]
    public async Task Each_viewer_sees_the_reviews_they_may_read_and_no_rating()
    {
        await using var world = await CreateAsync();
        Assert.Empty(await ProgressAsync(world.Admin));

        await world.LaunchAsync(await world.CreateRoundAsync());

        var hr = await ProgressAsync(world.Admin);
        Assert.Equal(new[] { world.Aicha, world.Fares, world.Tarek, world.Mariam }.Select(p => p.StableEmployeeKey).Order(),
            hr.Keys.Order());
        var aicha = hr[world.Aicha.StableEmployeeKey];
        Assert.Equal("SelfAssessment", aicha.GetProperty("state").GetString());
        Assert.False(aicha.GetProperty("isOverdue").GetBoolean());
        Assert.Equal(["employeeKey", "state", "dueDate", "isOverdue"], aicha.EnumerateObject().Select(p => p.Name));

        // A manager: the reviews they write and their own; never a peer's.
        var manager = await ProgressAsync(world.As(world.Mariam));
        Assert.Equal(new[] { world.Aicha, world.Fares, world.Tarek, world.Mariam }.Select(p => p.StableEmployeeKey).Order(),
            manager.Keys.Order());
        Assert.Equal([world.Aicha.StableEmployeeKey], (await ProgressAsync(world.As(world.Aicha))).Keys);
        Assert.Empty(await ProgressAsync(world.As(world.Leila)));
    }

    [Fact]
    public async Task Without_the_direct_reports_grant_a_manager_sees_only_their_own()
    {
        await using var world = await CreateAsync();
        await world.LaunchAsync(await world.CreateRoundAsync());
        using var client = world.Factory.CreateAuthenticatedClient(employeeId: world.Mariam.EmployeeId, permissions:
            [new(PerformancePermissions.CycleView, PermissionScopes.Self), new(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self)]);

        Assert.Equal([world.Mariam.StableEmployeeKey], (await ProgressAsync(client)).Keys);
    }

    [Fact]
    public async Task No_performance_grant_is_refused_and_another_tenant_sees_nothing()
    {
        await using var world = await CreateAsync();
        await world.LaunchAsync(await world.CreateRoundAsync());

        using var none = world.Factory.CreateAuthenticatedClient(employeeId: world.Aicha.EmployeeId, permissions: []);
        Assert.Equal(HttpStatusCode.Forbidden, (await none.GetAsync(Path)).StatusCode);

        using var outsider = world.Factory.CreateAuthenticatedClient(tenantId: Guid.NewGuid(), employeeId: world.Amira.EmployeeId,
            permissions: [new(PerformancePermissions.CycleManage, PermissionScopes.Tenant), new(PerformancePermissions.CycleView, PermissionScopes.Tenant)]);
        Assert.Empty(await ProgressAsync(outsider));
    }

    [Fact]
    public async Task Core_being_unreachable_is_reported_not_answered_empty()
    {
        await using var world = await CreateAsync();
        await world.LaunchAsync(await world.CreateRoundAsync());
        world.Factory.Core.Unavailable = true;

        var (status, _, _) = await Failure(await world.Admin.GetAsync(Path));
        Assert.NotEqual(HttpStatusCode.OK, status);
    }
}
