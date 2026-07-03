using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ObjectivePolicy;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Commands;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Dtos;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.ObjectivePolicy;

public class ObjectivePolicyCompatibilityTests
{
    [Fact]
    public async Task CompatibilityChecker_Flags_Active_Template_Revisions_With_Unsupported_Measurement_Type()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var template = ObjectiveTemplate.Create(tenantId);
        template.CreateDraftRevision(
            "Coaching Quality",
            null,
            null,
            "Qualitative",
            null,
            null,
            null,
            null,
            "Monthly coaching completed.",
            Guid.NewGuid().ToString(),
            "Seeder");
        template.ActivateRevision(Guid.NewGuid().ToString(), "Seeder", null);

        db.ObjectiveTemplateContainers.Add(template);
        await db.SaveChangesAsync();

        var policy = TenantObjectivePolicy.Create(tenantId);
        var proposedPolicy = TenantObjectivePolicyVersion.CreateApplied(
            tenantId,
            policy.Id,
            1,
            4,
            "25,50",
            5,
            "Optional",
            "Quantitative",
            true,
            Guid.NewGuid(),
            "Tester",
            null);
        db.TenantObjectivePolicies.Add(policy);
        await db.SaveChangesAsync();

        var checker = new TemplateCompatibilityChecker(db);

        var issues = await checker.CheckAsync(proposedPolicy, CancellationToken.None);

        Assert.Contains(issues, issue => issue.ConflictingField == "MeasurementType");
    }

    [Fact]
    public async Task ApplyPolicy_Blocks_When_Active_Template_Revisions_Would_Become_Invalid()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);

        var guardrails = PlatformPerformanceGuardrails.CreateApplied(
            1, 10, 0, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10);
        db.PlatformPerformanceGuardrails.Add(guardrails);

        var template = ObjectiveTemplate.Create(tenantId);
        template.CreateDraftRevision(
            "Coaching Quality",
            null,
            null,
            "Qualitative",
            null,
            null,
            null,
            null,
            "Monthly coaching completed.",
            Guid.NewGuid().ToString(),
            "Seeder");
        template.ActivateRevision(Guid.NewGuid().ToString(), "Seeder", null);
        db.ObjectiveTemplateContainers.Add(template);

        var policy = TenantObjectivePolicy.Create(tenantId);
        var current = policy.ApplyPolicy(4, "25,50", 5, "Optional", "Quantitative,Qualitative", true, Guid.NewGuid(), "Tester", null);
        db.TenantObjectivePolicies.Add(policy);
        await db.SaveChangesAsync();

        var actor = new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).WithFullName("Policy Admin").Build();
        var handler = new ApplyPolicyCommandHandler(
            db,
            tenantContext,
            new ConfigurationAuditWriter(db),
            new PolicyValidator(),
            new TemplateCompatibilityChecker(db));

        var result = await handler.Handle(
            new ApplyPolicyCommand(
                actor,
                new ApplyPolicyRequest(4, "25,50", 5, "Optional", "Quantitative", true, null),
                current.Version),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("ObjectivePolicy.TemplateCompatibilityConflict", result.Error.Code);
    }

    [Fact]
    public async Task ApplyPolicy_Creates_New_Active_Version_And_Supersedes_Current()
    {
        var tenantId = Guid.NewGuid();
        var databaseName = $"policy-apply-{Guid.NewGuid()}";
        uint expectedVersion;

        await using (var seedDb = PerformanceTestContext.Create(tenantId, out _, databaseName))
        {
            var guardrails = PlatformPerformanceGuardrails.CreateApplied(
                1, 10, 1, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10);
            seedDb.PlatformPerformanceGuardrails.Add(guardrails);

            var policy = TenantObjectivePolicy.Create(tenantId);
            var current = policy.ApplyPolicy(4, "25,50", 5, "Optional", "Quantitative,Qualitative", true, Guid.NewGuid(), "Tester", null);
            seedDb.TenantObjectivePolicies.Add(policy);
            await seedDb.SaveChangesAsync();
            expectedVersion = current.Version;
        }

        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext, databaseName);

        var handler = new ApplyPolicyCommandHandler(
            db,
            tenantContext,
            new ConfigurationAuditWriter(db),
            new PolicyValidator(),
            new TemplateCompatibilityChecker(db));

        var result = await handler.Handle(
            new ApplyPolicyCommand(
                new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).WithFullName("Policy Admin").Build(),
                new ApplyPolicyRequest(5, "10,20,25,50,100", 7, "Optional", "Quantitative,Qualitative", true, "Updated policy"),
                expectedVersion),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, db.TenantObjectivePolicyVersions.Count());
        Assert.Contains(db.TenantObjectivePolicyVersions, v => v.Status == PolicyVersionStatus.Superseded && v.VersionNumber == 1);
        Assert.Contains(db.TenantObjectivePolicyVersions, v => v.Status == PolicyVersionStatus.Active && v.VersionNumber == 2);
    }

    [Fact]
    public async Task ApplyPolicy_Rejects_Stale_Update_Without_Changing_Current()
    {
        var tenantId = Guid.NewGuid();
        var databaseName = $"policy-stale-{Guid.NewGuid()}";
        uint staleVersion;

        await using (var seedDb = PerformanceTestContext.Create(tenantId, out _, databaseName))
        {
            var policy = TenantObjectivePolicy.Create(tenantId);
            var current = policy.ApplyPolicy(4, "25,50", 5, "Optional", "Quantitative,Qualitative", true, Guid.NewGuid(), "Tester", null);
            seedDb.TenantObjectivePolicies.Add(policy);
            await seedDb.SaveChangesAsync();
            staleVersion = current.Version + 1;
        }

        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext, databaseName);

        var handler = new ApplyPolicyCommandHandler(
            db,
            tenantContext,
            new ConfigurationAuditWriter(db),
            new PolicyValidator(),
            new TemplateCompatibilityChecker(db));

        var result = await handler.Handle(
            new ApplyPolicyCommand(
                new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).WithFullName("Policy Admin").Build(),
                new ApplyPolicyRequest(5, "10,20,25,50,100", 7, "Optional", "Quantitative,Qualitative", true, null),
                staleVersion),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("ObjectivePolicy.StaleApply", result.Error.Code);
        Assert.Single(db.TenantObjectivePolicyVersions);
        Assert.Contains(db.TenantObjectivePolicyVersions, v => v.Status == PolicyVersionStatus.Active);
    }
}
