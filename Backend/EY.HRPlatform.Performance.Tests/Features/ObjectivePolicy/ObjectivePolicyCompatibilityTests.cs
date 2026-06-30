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
        var draft = policy.CreateDraft(4, "25,50", 5, "Optional", "Quantitative", true, Guid.NewGuid(), "Tester");
        db.TenantObjectivePolicies.Add(policy);
        await db.SaveChangesAsync();

        var checker = new TemplateCompatibilityChecker(db);

        var issues = await checker.CheckAsync(draft, CancellationToken.None);

        Assert.Contains(issues, issue => issue.ConflictingField == "MeasurementType");
    }

    [Fact]
    public async Task PublishPolicy_Blocks_When_Active_Template_Revisions_Would_Become_Invalid()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);

        var guardrails = PlatformPerformanceGuardrails.CreateDraft(
            1, 10, 0, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10, true);
        guardrails.Publish();
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
        policy.CreateDraft(4, "25,50", 5, "Optional", "Quantitative", true, Guid.NewGuid(), "Tester");
        db.TenantObjectivePolicies.Add(policy);
        await db.SaveChangesAsync();

        var actor = new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).WithFullName("Policy Admin").Build();
        var handler = new PublishPolicyCommandHandler(
            db,
            tenantContext,
            new ConfigurationAuditWriter(db),
            new PolicyValidator(),
            new TemplateCompatibilityChecker(db));

        var result = await handler.Handle(
            new PublishPolicyCommand(
                actor,
                new PublishPolicyRequest(policy.Draft!.Version, null)),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("ObjectivePolicy.TemplateCompatibilityConflict", result.Error.Code);
    }
}
