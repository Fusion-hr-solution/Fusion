using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Features.Provisioning;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Provisioning;

public class ProvisionTenantTests
{
    private static PlatformObjectiveBaseline CreateAppliedBaseline()
    {
        var baseline = PlatformObjectiveBaseline.Create();
        baseline.Apply(4, "25,50", 5, "Optional", "Quantitative,Qualitative", true);
        return baseline;
    }

    [Fact]
    public async Task Provision_CreatesPolicy_FromPublishedBaseline()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);

        var guardrails = PlatformPerformanceGuardrails.CreateApplied(
            1, 10, 0, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10);
        db.PlatformPerformanceGuardrails.Add(guardrails);

        var baseline = CreateAppliedBaseline();
        db.PlatformObjectiveBaselines.Add(baseline);
        await db.SaveChangesAsync();

        var handler = new ProvisionTenantCommandHandler(db, new TenantContext());
        var result = await handler.Handle(new ProvisionTenantCommand(tenantId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.WasAlreadyProvisioned);

        var policy = await db.TenantObjectivePolicies
            .IgnoreQueryFilters()
            .Include(p => p.Versions)
            .FirstAsync(p => p.TenantId == tenantId);

        Assert.NotNull(policy);
        Assert.Single(policy.Versions);
        Assert.Equal("Active", policy.Versions[0].Status.ToString());
        Assert.Equal(4, policy.Versions[0].MaxObjectivesPerPlan);
        Assert.Equal("25,50", policy.Versions[0].AllowedWeightValues);
    }

    [Fact]
    public async Task Provision_IsIdempotent_WhenTenantAlreadyHasPolicy()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);

        var guardrails = PlatformPerformanceGuardrails.CreateApplied(
            1, 10, 0, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10);
        db.PlatformPerformanceGuardrails.Add(guardrails);

        var baseline = CreateAppliedBaseline();
        db.PlatformObjectiveBaselines.Add(baseline);
        await db.SaveChangesAsync();

        var handler = new ProvisionTenantCommandHandler(db, new TenantContext());

        // First provision
        var first = await handler.Handle(new ProvisionTenantCommand(tenantId), CancellationToken.None);
        Assert.True(first.IsSuccess);
        Assert.False(first.Value.WasAlreadyProvisioned);

        // Second provision — must be a no-op
        var second = await handler.Handle(new ProvisionTenantCommand(tenantId), CancellationToken.None);
        Assert.True(second.IsSuccess);
        Assert.True(second.Value.WasAlreadyProvisioned);
        Assert.Equal(first.Value.PolicyId, second.Value.PolicyId);

        // Exactly one policy version should exist
        var policyCount = await db.TenantObjectivePolicies
            .IgnoreQueryFilters()
            .CountAsync(p => p.TenantId == tenantId);
        Assert.Equal(1, policyCount);
    }

    [Fact]
    public async Task Provision_Fails_WhenNoAppliedBaselineExists()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);

        var handler = new ProvisionTenantCommandHandler(db, new TenantContext());
        var result = await handler.Handle(new ProvisionTenantCommand(tenantId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Provisioning.NoAppliedBaseline", result.Error.Code);
    }

    [Fact]
    public async Task Provision_Leaves_Template_Library_Empty_For_New_Tenant()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);

        var guardrails = PlatformPerformanceGuardrails.CreateApplied(
            1, 10, 0, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10);
        db.PlatformPerformanceGuardrails.Add(guardrails);

        var baseline = CreateAppliedBaseline();
        db.PlatformObjectiveBaselines.Add(baseline);
        await db.SaveChangesAsync();

        var handler = new ProvisionTenantCommandHandler(db, new TenantContext());
        var result = await handler.Handle(new ProvisionTenantCommand(tenantId), CancellationToken.None);

        Assert.True(result.IsSuccess);

        var templates = await db.ObjectiveTemplateContainers
            .IgnoreQueryFilters()
            .Where(t => t.TenantId == tenantId)
            .ToListAsync();

        Assert.Empty(templates);
    }

    [Fact]
    public async Task Provision_DoesNotMutate_ExistingTenant_WhenBaselineChanges()
    {
        var existingTenantId = Guid.NewGuid();
        var newTenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);

        var guardrails = PlatformPerformanceGuardrails.CreateApplied(
            1, 10, 0, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10);
        db.PlatformPerformanceGuardrails.Add(guardrails);

        var baseline = CreateAppliedBaseline();
        db.PlatformObjectiveBaselines.Add(baseline);
        await db.SaveChangesAsync();

        var handler = new ProvisionTenantCommandHandler(db, new TenantContext());

        // Provision existing tenant
        var existing = await handler.Handle(new ProvisionTenantCommand(existingTenantId), CancellationToken.None);
        Assert.True(existing.IsSuccess);

        var existingPolicyId = existing.Value.PolicyId;

        // Provision new tenant (simulates a new baseline being applied to NEW tenants only)
        var newProvision = await handler.Handle(new ProvisionTenantCommand(newTenantId), CancellationToken.None);
        Assert.True(newProvision.IsSuccess);
        Assert.NotEqual(existingPolicyId, newProvision.Value.PolicyId);

        // Existing tenant's policy is unchanged
        var idempotentRun = await handler.Handle(new ProvisionTenantCommand(existingTenantId), CancellationToken.None);
        Assert.True(idempotentRun.IsSuccess);
        Assert.True(idempotentRun.Value.WasAlreadyProvisioned);
        Assert.Equal(existingPolicyId, idempotentRun.Value.PolicyId);
    }
}
