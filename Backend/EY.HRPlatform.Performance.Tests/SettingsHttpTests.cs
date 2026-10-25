using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Performance.Tests;

public sealed class SettingsHttpTests
{
    [Fact]
    public async Task Evidence_retention_settings_are_admin_only_tenant_scoped_and_positive()
    {
        await using var factory = new PerformanceApiFactory();
        using var viewer = factory.CreateAuthenticatedClient(permissions:
            [new(PerformancePermissions.CycleView, PermissionScopes.Tenant)]);
        using var denied = await viewer.GetAsync("/api/performance/settings");
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);

        using var admin = factory.CreateAuthenticatedClient(permissions:
            [new(PerformancePermissions.CycleManage, PermissionScopes.Tenant), new(PerformancePermissions.CycleView, PermissionScopes.Tenant), new(PerformancePermissions.SettingsManage, PermissionScopes.Tenant)]);
        using var initialResponse = await admin.GetAsync("/api/performance/settings");
        Assert.Equal(HttpStatusCode.OK, initialResponse.StatusCode);
        using var initialJson = JsonDocument.Parse(await initialResponse.Content.ReadAsStringAsync());
        var initial = initialJson.RootElement.GetProperty("data");
        Assert.Equal(36, initial.GetProperty("evidenceRetentionMonths").GetInt32());
        var version = initial.GetProperty("version").GetUInt32();

        using var update = await admin.PutAsJsonAsync("/api/performance/settings", new
        {
            defaultMeasurementMethod = "NumericTarget",
            suggestedObjectiveCountMin = 3,
            suggestedObjectiveCountMax = 6,
            planningDeadlineOffsetDays = 30,
            planAlignmentPolicy = "AtLeastOneConnected",
            defaultSelfAssessmentEnabled = true,
            defaultObjectiveRatingsEnabled = true,
            defaultCalibrationEnabled = false,
            evidenceRetentionMonths = 18,
            expectedVersion = version,
        });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        using var updatedJson = JsonDocument.Parse(await update.Content.ReadAsStringAsync());
        var updated = updatedJson.RootElement.GetProperty("data");
        Assert.Equal(18, updated.GetProperty("evidenceRetentionMonths").GetInt32());

        using var invalid = await admin.PutAsJsonAsync("/api/performance/settings", new
        {
            defaultMeasurementMethod = "NumericTarget",
            suggestedObjectiveCountMin = 3,
            suggestedObjectiveCountMax = 6,
            planningDeadlineOffsetDays = 30,
            planAlignmentPolicy = "AtLeastOneConnected",
            defaultSelfAssessmentEnabled = true,
            defaultObjectiveRatingsEnabled = true,
            defaultCalibrationEnabled = false,
            evidenceRetentionMonths = 0,
            expectedVersion = updated.GetProperty("version").GetUInt32(),
        });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

        using var tenantB = factory.CreateAuthenticatedClient(tenantId: Guid.NewGuid(), permissions:
            [new(PerformancePermissions.CycleManage, PermissionScopes.Tenant), new(PerformancePermissions.CycleView, PermissionScopes.Tenant), new(PerformancePermissions.SettingsManage, PermissionScopes.Tenant)]);
        using var otherTenantResponse = await tenantB.GetAsync("/api/performance/settings");
        Assert.Equal(HttpStatusCode.OK, otherTenantResponse.StatusCode);
        using var otherTenantJson = JsonDocument.Parse(await otherTenantResponse.Content.ReadAsStringAsync());
        Assert.Equal(36, otherTenantJson.RootElement.GetProperty("data").GetProperty("evidenceRetentionMonths").GetInt32());
    }
}
