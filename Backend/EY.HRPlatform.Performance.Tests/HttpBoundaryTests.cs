using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Performance.Tests;

public sealed class HttpBoundaryTests
{
    [Fact]
    public async Task Workspace_context_rejects_anonymous_callers()
    {
        await using var factory = new PerformanceApiFactory();
        using var client = factory.CreateClient();
        using var response = await client.GetAsync("/api/performance/context");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Competency_catalog_requires_tenant_performance_administration()
    {
        await using var factory = new PerformanceApiFactory();
        using var participant = factory.CreateAuthenticatedClient(permissions:
            [new(PerformancePermissions.CycleView, PermissionScopes.Tenant)]);
        using var denied = await participant.GetAsync("/api/performance/settings/competencies");
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);

        using var admin = factory.CreateAuthenticatedClient(permissions:
            [new(PerformancePermissions.CycleManage, PermissionScopes.Tenant)]);
        using var allowed = await admin.GetAsync("/api/performance/settings/competencies");
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
    }

    [Fact]
    public async Task Competency_catalog_isolated_to_the_token_tenant()
    {
        await using var factory = new PerformanceApiFactory();
        var own = EY.HRPlatform.Performance.Domain.Settings.Competency.Create(factory.Store.TenantId,
            "Own tenant", "Visible only here", []);
        await using (var db = factory.Store.NewContext())
        {
            db.Competencies.Add(own);
            await db.SaveChangesAsync();
        }
        var otherTenant = Guid.NewGuid();
        await using (var db = factory.Store.NewContext(TestTenantContext.WithTenant(otherTenant)))
        {
            db.Competencies.Add(EY.HRPlatform.Performance.Domain.Settings.Competency.Create(otherTenant,
                "Other tenant", "Must remain hidden", []));
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateAuthenticatedClient(permissions:
            [new(PerformancePermissions.CycleManage, PermissionScopes.Tenant)]);
        using var response = await client.GetAsync("/api/performance/settings/competencies");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var envelope = await response.Content.ReadFromJsonAsync<ApiResponse<List<CompetencyDto>>>();
        Assert.Equal(own.Id, Assert.Single(envelope!.Data!).Id);
    }

    [Fact]
    public async Task Workspace_context_resolves_the_token_tenant_and_ignores_a_spoofed_header()
    {
        await using var factory = new PerformanceApiFactory();
        var otherTenant = Guid.NewGuid();
        var start = new DateOnly(2026, 1, 1);
        var own = PerformanceCycle.CreateDraft(factory.Store.TenantId, "Own cycle", start, start.AddYears(1), start.AddDays(30));
        await using (var db = factory.Store.NewContext())
        {
            db.Cycles.Add(own);
            await db.SaveChangesAsync();
        }
        await using (var db = factory.Store.NewContext(TestTenantContext.WithTenant(otherTenant)))
        {
            db.Cycles.Add(PerformanceCycle.CreateDraft(otherTenant, "Other cycle", start, start.AddYears(1), start.AddDays(30)));
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateAuthenticatedClient(permissions:
            [new(PerformancePermissions.CycleView, PermissionScopes.Self),
                new(PerformancePermissions.CycleManage, PermissionScopes.Tenant)]);
        client.DefaultRequestHeaders.Add("X-Tenant-Id", otherTenant.ToString());

        using var response = await client.GetAsync("/api/performance/context");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        json.Converters.Add(new JsonStringEnumConverter());
        var envelope = await response.Content.ReadFromJsonAsync<ApiResponse<WorkspaceContextDto>>(json);
        Assert.NotNull(envelope?.Data);
        Assert.Equal(own.Id, Assert.Single(envelope.Data.Cycles).Id);
    }
    [Theory]
    [InlineData(PermissionScopes.DirectReports)]
    [InlineData(PermissionScopes.OrgUnit)]
    [InlineData(PermissionScopes.Self)]
    public async Task Workspace_context_applies_the_actual_organization_read_boundary(string scope)
    {
        await using var factory = new PerformanceApiFactory();
        using var client = factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(), permissions:
            [new(PerformancePermissions.CycleView, scope)]);
        using var response = await client.GetAsync("/api/performance/context");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var envelope = await response.Content.ReadFromJsonAsync<ApiResponse<WorkspaceContextDto>>();
        Assert.Equal(scope != PermissionScopes.Self, envelope!.Data!.Capabilities.CanViewOrgDirection);
    }
}
