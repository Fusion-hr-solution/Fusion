using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Ai;

/// <summary>The tenant AI switch in Settings and the AI capability every surface reads.</summary>
public sealed class AiAssistanceSwitchHttpTests
{
    private static readonly EffectivePermissionGrant[] Admin =
        [new(PerformancePermissions.CycleManage, PermissionScopes.Tenant), new(PerformancePermissions.CycleView, PermissionScopes.Tenant)];

    [Fact]
    public async Task Switch_is_on_by_default_persists_is_audited_and_survives_older_clients()
    {
        await using var factory = new PerformanceApiFactory();
        using var admin = factory.CreateAuthenticatedClient(permissions: Admin);

        var initial = await Data(await admin.GetAsync("/api/performance/settings"));
        Assert.True(initial.GetProperty("aiAssistanceEnabled").GetBoolean());

        var off = await Data(await admin.PutAsJsonAsync("/api/performance/settings",
            Body(initial.GetProperty("version").GetUInt32(), aiAssistanceEnabled: false)));
        Assert.False(off.GetProperty("aiAssistanceEnabled").GetBoolean());

        // A client that doesn't know the field leaves the switch where it is.
        var older = await Data(await admin.PutAsJsonAsync("/api/performance/settings",
            Body(off.GetProperty("version").GetUInt32(), aiAssistanceEnabled: null, retention: 24)));
        Assert.False(older.GetProperty("aiAssistanceEnabled").GetBoolean());

        await using var db = factory.Store.NewContext();
        var changes = await db.AuditEntries.Where(entry => entry.Action == PerformanceAuditActions.SettingsChanged).ToListAsync();
        Assert.Contains(changes, entry => entry.Summary.Contains("\"AiAssistanceEnabled\":false"));
    }

    [Fact]
    public async Task Non_administrator_cannot_change_the_switch()
    {
        await using var factory = new PerformanceApiFactory();
        using var viewer = factory.CreateAuthenticatedClient(permissions: [new(PerformancePermissions.CycleView, PermissionScopes.Tenant)]);

        using var response = await viewer.PutAsJsonAsync("/api/performance/settings", Body(0, aiAssistanceEnabled: false));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Switch_is_per_tenant()
    {
        await using var factory = new PerformanceApiFactory();
        using var admin = factory.CreateAuthenticatedClient(permissions: Admin);
        var initial = await Data(await admin.GetAsync("/api/performance/settings"));
        await Data(await admin.PutAsJsonAsync("/api/performance/settings", Body(initial.GetProperty("version").GetUInt32(), aiAssistanceEnabled: false)));

        using var otherTenant = factory.CreateAuthenticatedClient(tenantId: Guid.NewGuid(), permissions: Admin);
        var other = await Data(await otherTenant.GetAsync("/api/performance/settings"));

        Assert.True(other.GetProperty("aiAssistanceEnabled").GetBoolean());
    }

    [Fact]
    public async Task Capability_follows_switch_and_provider()
    {
        await using var factory = new PerformanceApiFactory();
        using var admin = factory.CreateAuthenticatedClient(permissions: Admin);

        Assert.True(await AiCapability(admin));

        factory.Ai.IsAvailable = false; // no key, refused credentials, or cooling down
        Assert.False(await AiCapability(admin));
        factory.Ai.IsAvailable = true;

        var settings = await Data(await admin.GetAsync("/api/performance/settings"));
        await Data(await admin.PutAsJsonAsync("/api/performance/settings", Body(settings.GetProperty("version").GetUInt32(), aiAssistanceEnabled: false)));
        Assert.False(await AiCapability(admin));
    }

    private static async Task<bool> AiCapability(HttpClient client)
    {
        var context = await Data(await client.GetAsync("/api/performance/context"));
        return context.GetProperty("capabilities").GetProperty("aiAssistance").GetBoolean();
    }

    private static object Body(uint version, bool? aiAssistanceEnabled, int retention = 36) => new
    {
        defaultMeasurementMethod = "NumericTarget",
        suggestedObjectiveCountMin = 3,
        suggestedObjectiveCountMax = 6,
        planningDeadlineOffsetDays = 30,
        planAlignmentPolicy = "AtLeastOneConnected",
        evidenceRetentionMonths = retention,
        aiAssistanceEnabled,
        expectedVersion = version,
    };

    private static async Task<JsonElement> Data(HttpResponseMessage response)
    {
        using (response)
        {
            Assert.True(response.IsSuccessStatusCode, $"{(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return json.RootElement.GetProperty("data").Clone();
        }
    }
}
