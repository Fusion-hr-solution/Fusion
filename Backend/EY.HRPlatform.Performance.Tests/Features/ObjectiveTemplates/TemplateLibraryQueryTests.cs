using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Features.ObjectivePolicy;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Commands;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.ObjectiveTemplates;

public class TemplateLibraryQueryTests
{
    [Fact]
    public async Task GetTemplateLibrary_Returns_Templates_With_Active_First()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);

        var guardrails = PlatformPerformanceGuardrails.CreateDraft(1, 10, 0, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10, true);
        guardrails.Publish();
        db.PlatformPerformanceGuardrails.Add(guardrails);

        var policy = TenantObjectivePolicy.Create(tenantId);
        policy.CreateDraft(5, "10,20,25,50,100", 5, "Optional", "Quantitative,Qualitative", true, Guid.NewGuid(), "Tester");
        policy.PublishDraft(Guid.NewGuid(), "Tester", null);
        db.TenantObjectivePolicies.Add(policy);

        var draftOnly = ObjectiveTemplate.Create(tenantId);
        draftOnly.CreateDraftRevision("Draft Only", null, null, "Qualitative", null, null, null, null, "Clear criteria", Guid.NewGuid().ToString(), "Tester");

        var active = ObjectiveTemplate.Create(tenantId);
        active.CreateDraftRevision("Active Template", null, null, "Qualitative", null, null, null, null, "Clear criteria", Guid.NewGuid().ToString(), "Tester");
        active.ActivateRevision(Guid.NewGuid().ToString(), "Tester", null);

        db.ObjectiveTemplateContainers.AddRange(draftOnly, active);
        await db.SaveChangesAsync();

        var handler = new GetTemplateLibraryQueryHandler(db);

        var result = await handler.Handle(new GetTemplateLibraryQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.TotalCount);
        Assert.Collection(
            result.Value.Items,
            first => Assert.Equal("Active", first.Status),
            second => Assert.Equal("Draft", second.Status));
    }
}
