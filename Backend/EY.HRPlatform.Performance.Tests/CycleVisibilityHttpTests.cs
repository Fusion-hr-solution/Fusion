using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Performance.Tests;

public sealed class CycleVisibilityHttpTests
{
    [Fact]
    public async Task Workspace_cycles_and_detail_use_the_same_visibility_rule()
    {
        await using var factory = new PerformanceApiFactory();
        var tenant = factory.Store.TenantId;
        var start = new DateOnly(2026, 1, 1);
        var active = PerformanceCycle.CreateDraft(tenant, "Active", start, start.AddYears(1), start.AddDays(30)).Activated();
        var draft = PerformanceCycle.CreateDraft(tenant, "Draft", start, start.AddYears(1), start.AddDays(30));
        var closed = PerformanceCycle.CreateDraft(tenant, "Closed", start, start.AddYears(1), start.AddDays(30)).Activated();
        closed.Close();
        var nonparticipant = Guid.NewGuid();
        var unrelated = Guid.NewGuid();
        var participant = Participant.Create(tenant, closed.Id, unrelated, "Unrelated participant", null, null, null,
            Guid.NewGuid(), "Unrelated manager", false, start);
        await using (var db = factory.Store.NewContext())
        {
            db.Cycles.AddRange(active, draft, closed);
            db.Participants.Add(participant);
            await db.SaveChangesAsync();
        }

        using var employee = factory.CreateAuthenticatedClient(employeeId: nonparticipant,
            permissions: [new(PerformancePermissions.CycleView, PermissionScopes.Self)]);
        Assert.Equal(HttpStatusCode.OK, (await employee.GetAsync($"/api/performance/cycles/{active.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await employee.GetAsync($"/api/performance/cycles/{draft.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await employee.GetAsync($"/api/performance/cycles/{closed.Id}")).StatusCode);
        var employeeContext = await employee.GetFromJsonAsync<JsonElement>("/api/performance/context");
        Assert.Equal([active.Id], employeeContext.GetProperty("data").GetProperty("cycles").EnumerateArray()
            .Select(item => item.GetProperty("id").GetGuid()).ToArray());

        using var tenantViewer = factory.CreateAuthenticatedClient(employeeId: nonparticipant,
            permissions: [new(PerformancePermissions.CycleView, PermissionScopes.Tenant)]);
        Assert.Equal(HttpStatusCode.OK, (await tenantViewer.GetAsync($"/api/performance/cycles/{closed.Id}")).StatusCode);
        var tenantContext = await tenantViewer.GetFromJsonAsync<JsonElement>("/api/performance/context");
        Assert.Contains(tenantContext.GetProperty("data").GetProperty("cycles").EnumerateArray(), item => item.GetProperty("id").GetGuid() == closed.Id);
        Assert.DoesNotContain(tenantContext.GetProperty("data").GetProperty("cycles").EnumerateArray(), item => item.GetProperty("id").GetGuid() == draft.Id);

        using var admin = factory.CreateAuthenticatedClient(employeeId: nonparticipant,
            permissions: [new(PerformancePermissions.CycleView, PermissionScopes.Tenant), new(PerformancePermissions.CycleManage, PermissionScopes.Tenant)]);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/performance/cycles/{draft.Id}")).StatusCode);
        var adminContext = await admin.GetFromJsonAsync<JsonElement>("/api/performance/context");
        Assert.Equal(3, adminContext.GetProperty("data").GetProperty("cycles").GetArrayLength());
    }
}

\n