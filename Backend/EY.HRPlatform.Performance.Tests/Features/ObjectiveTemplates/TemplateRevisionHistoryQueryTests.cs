using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.ObjectiveTemplates;

public class TemplateRevisionHistoryQueryTests
{
    [Fact]
    public async Task History_Lists_Current_And_Prior_Revisions_Newest_First()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var template = ObjectiveTemplate.Create(tenantId);
        template.CreateDraftRevision("Original", null, null, "Qualitative", null, null, null, null, "Clear criteria", Guid.NewGuid().ToString(), "Author");
        template.ActivateRevision(Guid.NewGuid().ToString(), "Author", "Initial activation");
        template.CreateDraftRevision("Revised", null, null, "Qualitative", null, null, null, null, "Clear criteria", Guid.NewGuid().ToString(), "Author");
        template.ActivateRevision(Guid.NewGuid().ToString(), "Author", "Second activation");
        db.ObjectiveTemplateContainers.Add(template);
        await db.SaveChangesAsync();

        var handler = new GetTemplateRevisionHistoryQueryHandler(db);

        var result = await handler.Handle(new GetTemplateRevisionHistoryQuery(template.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Count);
        Assert.Collection(
            result.Value,
            current =>
            {
                Assert.Equal(2, current.VersionNumber);
                Assert.Equal("Active", current.Status);
                Assert.Equal("Second activation", current.ChangeSummary);
                Assert.Null(current.SupersededAt);
            },
            prior =>
            {
                Assert.Equal(1, prior.VersionNumber);
                Assert.Equal("Superseded", prior.Status);
                Assert.NotNull(prior.SupersededAt);
            });
    }

    [Fact]
    public async Task History_For_Unknown_Template_Fails_With_Not_Found()
    {
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);

        var handler = new GetTemplateRevisionHistoryQueryHandler(db);

        var result = await handler.Handle(new GetTemplateRevisionHistoryQuery(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task History_Is_Tenant_Scoped_And_Fails_Closed_For_Other_Tenants()
    {
        var ownerTenantId = Guid.NewGuid();
        var dbName = $"template-history-{Guid.NewGuid()}";

        Guid templateId;
        await using (var seed = PerformanceTestContext.Create(ownerTenantId, out _, dbName))
        {
            var template = ObjectiveTemplate.Create(ownerTenantId);
            template.CreateDraftRevision("Owner Template", null, null, "Qualitative", null, null, null, null, "Clear criteria", Guid.NewGuid().ToString(), "Author");
            seed.ObjectiveTemplateContainers.Add(template);
            await seed.SaveChangesAsync();
            templateId = template.Id;
        }

        await using var otherTenantDb = PerformanceTestContext.Create(Guid.NewGuid(), out _, dbName);
        var handler = new GetTemplateRevisionHistoryQueryHandler(otherTenantDb);

        var result = await handler.Handle(new GetTemplateRevisionHistoryQuery(templateId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }
}
