using System.Net;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Conversations;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using static EY.HRPlatform.Performance.Tests.TestHelpers.CalibrationWorld;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>Core HR's change panel asks what a new reporting line does here: the cycle's reviewer stays, 1:1s end.</summary>
public sealed class LineEffectsHttpTests
{
    private static readonly EffectivePermissionGrant[] PeopleAdmin = [new(CorePermissions.EmployeeManage, PermissionScopes.Tenant)];
    private static readonly EffectivePermissionGrant[] ReportingAdmin = [new(CorePermissions.ReportingManage, PermissionScopes.Tenant)];

    [Fact]
    public async Task A_new_manager_keeps_the_cycle_reviewer_and_ends_the_one_on_ones_with_the_old_one()
    {
        await using var factory = new PerformanceApiFactory();
        Guid aicha, mariam, meriem = Guid.NewGuid();
        await using (var db = factory.Store.NewContext())
        {
            var world = await SeedAsync(db, factory.Store, [new("Aicha Bouazizi", "Mariam Gharbi")], start: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)));
            (aicha, mariam) = (world.Reviews[0].SubjectEmployeeId, world.Reviews[0].ReviewerEmployeeId);
            var (series, meeting) = OneOnOneSeries.Start(factory.Store.TenantId, mariam, aicha, OneOnOneCadence.EveryTwoWeeks, mariam,
                DateTime.UtcNow.AddDays(-14), DateTime.UtcNow.AddDays(-30), "Mariam Gharbi", "Aicha Bouazizi");
            db.AddRange(series, meeting);
            await db.SaveChangesAsync();
        }

        foreach (var grants in new[] { PeopleAdmin, ReportingAdmin })
        {
            using var client = factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(), permissions: grants);
            var response = await client.GetAsync($"/api/performance/people/{aicha}/line-effects?manager={meriem}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var data = (await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync())).RootElement.GetProperty("data");
            Assert.Equal("Mariam Gharbi", data.GetProperty("reviewersStay")[0].GetProperty("reviewerName").GetString());
            Assert.Equal("FY27", data.GetProperty("reviewersStay")[0].GetProperty("cycleName").GetString());
            Assert.Equal("Mariam Gharbi", data.GetProperty("oneOnOnesEnd")[0].GetProperty("managerName").GetString());
        }

        // Staying with the same manager changes nothing here.
        using var admin = factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(), permissions: PeopleAdmin);
        var same = (await JsonDocument.ParseAsync(await (await admin.GetAsync($"/api/performance/people/{aicha}/line-effects?manager={mariam}"))
            .Content.ReadAsStreamAsync())).RootElement.GetProperty("data");
        Assert.Equal(0, same.GetProperty("reviewersStay").GetArrayLength());
        Assert.Equal(0, same.GetProperty("oneOnOnesEnd").GetArrayLength());
    }

    [Fact]
    public async Task Only_people_who_change_reporting_lines_may_ask()
    {
        await using var factory = new PerformanceApiFactory();
        using var reviewer = factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(),
            permissions: [new(PerformancePermissions.CycleView, PermissionScopes.Tenant), new(PerformancePermissions.CycleManage, PermissionScopes.Tenant)]);
        Assert.Equal(HttpStatusCode.Forbidden, (await reviewer.GetAsync($"/api/performance/people/{Guid.NewGuid()}/line-effects")).StatusCode);
    }
}
