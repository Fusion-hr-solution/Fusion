using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Features.Provisioning;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Provisioning;

public class ProvisionTenantTests
{
    private static PlatformObjectiveBaseline CreatePublishedBaseline()
    {
        var guardrails = PlatformPerformanceGuardrails.CreateDraft(
            1, 10, 0, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10, true);
        guardrails.Publish();

        var baseline = PlatformObjectiveBaseline.Create();
        baseline.CreateDraft(4, "25,50", 5, "Optional", "Quantitative,Qualitative", true);
        baseline.PublishDraft();
        return baseline;
    }

    [Fact]
    public async Task Provision_CreatesPolicy_FromPublishedBaseline()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);

        var guardrails = PlatformPerformanceGuardrails.CreateDraft(
            1, 10, 0, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10, true);
        guardrails.Publish();
        db.PlatformPerformanceGuardrails.Add(guardrails);

        var baseline = CreatePublishedBaseline();
        db.PlatformObjectiveBaselines.Add(baseline);
        await db.SaveChangesAsync();

        var handler = new ProvisionTenantCommandHandler(db);
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

        var guardrails = PlatformPerformanceGuardrails.CreateDraft(
            1, 10, 0, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10, true);
        guardrails.Publish();
        db.PlatformPerformanceGuardrails.Add(guardrails);

        var baseline = CreatePublishedBaseline();
        db.PlatformObjectiveBaselines.Add(baseline);
        await db.SaveChangesAsync();

        var handler = new ProvisionTenantCommandHandler(db);

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
    public async Task Provision_Fails_WhenNoPublishedBaselineExists()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);

        var handler = new ProvisionTenantCommandHandler(db);
        var result = await handler.Handle(new ProvisionTenantCommand(tenantId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Provisioning.NoPublishedBaseline", result.Error.Code);
    }

    [Fact]
    public async Task Provision_CopiesActiveStarterTemplates_AsActiveRevisions()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);

        var guardrails = PlatformPerformanceGuardrails.CreateDraft(
            1, 10, 0, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10, true);
        guardrails.Publish();
        db.PlatformPerformanceGuardrails.Add(guardrails);

        var baseline = CreatePublishedBaseline();
        db.PlatformObjectiveBaselines.Add(baseline);

        var starter = PlatformStarterTemplate.Create(
            "Quality Improvement", "Improve quality metrics.", "Quantitative",
            null, null, 100m, "%", "Achieve 95% quality score", 1);
        db.PlatformStarterTemplates.Add(starter);
        await db.SaveChangesAsync();

        var handler = new ProvisionTenantCommandHandler(db);
        var result = await handler.Handle(new ProvisionTenantCommand(tenantId), CancellationToken.None);

        Assert.True(result.IsSuccess);

        var templates = await db.ObjectiveTemplateContainers
            .IgnoreQueryFilters()
            .Include(t => t.Revisions)
            .Where(t => t.TenantId == tenantId)
            .ToListAsync();

        Assert.Single(templates);
        Assert.Equal("Active", templates[0].Status.ToString());
        Assert.Single(templates[0].Revisions, r => r.Status.ToString() == "Active");
        Assert.Equal("Quality Improvement", templates[0].ActiveRevision!.Title);
    }

    [Fact]
    public async Task Provision_DoesNotMutate_ExistingTenant_WhenBaselineChanges()
    {
        var existingTenantId = Guid.NewGuid();
        var newTenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);

        var guardrails = PlatformPerformanceGuardrails.CreateDraft(
            1, 10, 0, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10, true);
        guardrails.Publish();
        db.PlatformPerformanceGuardrails.Add(guardrails);

        var baseline = CreatePublishedBaseline();
        db.PlatformObjectiveBaselines.Add(baseline);
        await db.SaveChangesAsync();

        var handler = new ProvisionTenantCommandHandler(db);

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
