using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Exceptions.Commands;
using EY.HRPlatform.Performance.Features.Exceptions.Services;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Http;

namespace EY.HRPlatform.Performance.Tests.Features.Exceptions;

public sealed class TransferExceptionOwnershipCommandHandlerTests
{
    [Fact]
    public async Task Transfer_CancelsPreviousResolutionTaskAndAssignsNewOwner()
    {
        var tenantId = Guid.NewGuid();
        var currentOwnerId = Guid.NewGuid();
        var newOwnerId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = CreateActiveCycle(tenantId, currentOwnerId, now);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();

        var service = new ExceptionCaseWorkflowService(db, new StubCurrentUserContext { EmployeeId = currentOwnerId });
        var exceptionCase = await service.OpenOrReuseAsync(
            new OpenExceptionCaseRequest(cycle.Id, Guid.NewGuid(), CampaignWorkItemType.TeamObjectiveApproval, Guid.NewGuid(), "Routing failed", "route-failed", new { }, now.AddDays(1)),
            CancellationToken.None);
        var oldTaskId = exceptionCase.CurrentResolutionWorkItemId;

        var httpContextAccessor = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipalBuilder()
                    .WithPermission(PerformancePermissions.ExceptionAction, PermissionScopes.Tenant)
                    .Build()
            }
        };

        var handler = new TransferExceptionOwnershipCommandHandler(
            db,
            new StubCurrentUserContext { EmployeeId = currentOwnerId },
            new PerformanceAccessPolicyService(),
            httpContextAccessor);

        var result = await handler.Handle(
            new TransferExceptionOwnershipCommand(cycle.Id, exceptionCase.Id, newOwnerId, "Shift to next operator"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(newOwnerId, exceptionCase.CurrentOwnerEmployeeId);
        Assert.NotEqual(oldTaskId, exceptionCase.CurrentResolutionWorkItemId);
        Assert.Equal(CampaignWorkItemStatus.Cancelled, db.CampaignWorkItems.Single(item => item.Id == oldTaskId).Status);
        Assert.Equal(newOwnerId, db.CampaignWorkItems.Single(item => item.Id == exceptionCase.CurrentResolutionWorkItemId).AssigneeEmployeeId);
    }

    private static PerformanceCycle CreateActiveCycle(Guid tenantId, Guid exceptionOwnerId, DateTime now)
    {
        var cycle = TestCycles.Create(tenantId, "FY review", PerformanceCycleType.Annual, now.AddDays(-2), now.AddDays(10));
        cycle.ConfigureGovernance(Guid.NewGuid(), true, 3, CampaignFeedbackVisibility.AnonymousToSubject, [exceptionOwnerId, Guid.NewGuid()]);
        cycle.BeginAssignmentPreparation(1, now.AddDays(-1));
        cycle.MarkReadyToLaunch(1, 0, true, now.AddHours(-12));
        cycle.Activate(now);
        return cycle;
    }
}
