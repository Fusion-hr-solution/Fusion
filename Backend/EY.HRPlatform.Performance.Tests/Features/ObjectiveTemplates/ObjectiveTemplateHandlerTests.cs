using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Commands;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.ObjectiveTemplates;

public class ObjectiveTemplateHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public async Task Create_PersistsActiveTemplate()
    {
        await using var db = PerformanceTestContext.Create(TenantId, out var tenantContext);
        var handler = new CreateObjectiveTemplateCommandHandler(db, tenantContext);

        var result = await handler.Handle(
            new CreateObjectiveTemplateCommand("Grow revenue", "desc", "Business", 25m), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Active", result.Value.Status);
        Assert.Equal(1, await db.ObjectiveTemplates.CountAsync());
    }

    [Fact]
    public async Task Create_WithDuplicateName_Fails()
    {
        await using var db = PerformanceTestContext.Create(TenantId, out var tenantContext);
        var handler = new CreateObjectiveTemplateCommandHandler(db, tenantContext);

        await handler.Handle(new CreateObjectiveTemplateCommand("Grow revenue", null, null, null), CancellationToken.None);
        var second = await handler.Handle(
            new CreateObjectiveTemplateCommand("grow revenue", null, null, null), CancellationToken.None);

        Assert.True(second.IsFailure);
        Assert.Equal("ObjectiveTemplate.DuplicateName", second.Error.Code);
    }
}
