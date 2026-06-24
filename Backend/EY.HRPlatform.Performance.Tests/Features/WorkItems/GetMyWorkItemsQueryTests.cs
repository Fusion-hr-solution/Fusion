using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.WorkItems.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.WorkItems;

public sealed class GetMyWorkItemsQueryTests
{
    [Fact]
    public async Task Handle_ReturnsOnlyWorkAssignedToCurrentEmployee()
    {
        var tenantId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        db.CampaignWorkItems.AddRange(
            CampaignWorkItem.Create(tenantId, Guid.NewGuid(), employeeId, employeeId,
                CampaignWorkItemType.ObjectivePlanning, DateTime.UtcNow.AddDays(7)),
            CampaignWorkItem.Create(tenantId, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
                CampaignWorkItemType.ManagerReview, DateTime.UtcNow.AddDays(7)));
        await db.SaveChangesAsync();

        var handler = new GetMyWorkItemsQueryHandler(db, new StubCurrentUserContext { EmployeeId = employeeId });

        var result = await handler.Handle(new GetMyWorkItemsQuery(), CancellationToken.None);

        var item = Assert.Single(result);
        Assert.Equal(employeeId, item.AssigneeEmployeeId);
        Assert.Equal("ObjectivePlanning", item.Type);
    }
}
