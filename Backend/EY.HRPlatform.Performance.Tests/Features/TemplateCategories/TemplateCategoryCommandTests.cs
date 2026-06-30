using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.TemplateCategories.Commands;
using EY.HRPlatform.Performance.Features.TemplateCategories.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.TemplateCategories;

public class TemplateCategoryCommandTests
{
    [Fact]
    public async Task Create_Rename_And_Archive_Write_Audit_Entries()
    {
        var tenantId = Guid.NewGuid();
        var actor = new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).Build();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        var audit = new ConfigurationAuditWriter(db);

        var create = new CreateCategoryCommandHandler(db, tenantContext, audit);
        var rename = new RenameCategoryCommandHandler(db, audit);
        var archive = new ArchiveCategoryCommandHandler(db, audit);

        var created = await create.Handle(
            new CreateCategoryCommand(actor, new CreateCategoryRequest("LEAD", "Leadership")),
            CancellationToken.None);
        Assert.True(created.IsSuccess);

        var renamed = await rename.Handle(
            new RenameCategoryCommand(created.Value.Id, actor, new RenameCategoryRequest("Leadership Excellence")),
            CancellationToken.None);
        Assert.True(renamed.IsSuccess);

        var archived = await archive.Handle(
            new ArchiveCategoryCommand(created.Value.Id, actor),
            CancellationToken.None);
        Assert.True(archived.IsSuccess);

        Assert.Collection(
            db.PerformanceConfigurationAuditEntries.OrderBy(e => e.CreatedAt),
            entry => Assert.Equal("CategoryCreated", entry.Action),
            entry => Assert.Equal("CategoryRenamed", entry.Action),
            entry => Assert.Equal("CategoryArchived", entry.Action));
    }
}
