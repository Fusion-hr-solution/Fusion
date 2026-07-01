using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Exceptions.Commands;
using EY.HRPlatform.Performance.Features.Exceptions.Services;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Http;

namespace EY.HRPlatform.Performance.Tests.Features.Exceptions;

public sealed class ResolveExceptionCaseCommandHandlerTests
{
    [Fact]
    public async Task Resolve_Override_ApprovesObjectiveAndClosesCase()
    {
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var exceptionOwnerEmployeeId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = CreateActiveCycle(tenantId, exceptionOwnerEmployeeId, now);
        var objective = PerformanceObjective.Create(
            tenantId, cycle.Id, ObjectiveLevel.Team, ownerEmployeeId,
            "Collective objective", null, "Ship", "100%", now.AddDays(5), 40m);
        objective.Submit(now);
        db.AddRange(cycle, objective);
        await db.SaveChangesAsync();

        var workflowService = new ExceptionCaseWorkflowService(db, new StubCurrentUserContext { EmployeeId = exceptionOwnerEmployeeId });
        var exceptionCase = await workflowService.OpenOrReuseAsync(
            new OpenExceptionCaseRequest(
                cycle.Id,
                objective.Id,
                CampaignWorkItemType.TeamObjectiveApproval,
                objective.Id,
                "Routing failed",
                "collective-route-failed",
                new { ObjectiveId = objective.Id },
                now.AddDays(2)),
            CancellationToken.None);

        var httpContextAccessor = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipalBuilder()
                    .WithPermission(PerformancePermissions.ExceptionAction, PermissionScopes.Tenant)
                    .Build()
            }
        };

        var handler = new ResolveExceptionCaseCommandHandler(
            db,
            new StubCurrentUserContext { EmployeeId = exceptionOwnerEmployeeId },
            new PerformanceAccessPolicyService(),
            httpContextAccessor);

        var result = await handler.Handle(
            new ResolveExceptionCaseCommand(cycle.Id, exceptionCase.Id, ExceptionResolutionAction.Override, "Approved through exception handling"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(ObjectiveStatus.Approved, objective.Status);
        Assert.Equal(ExceptionCaseStatus.Resolved, exceptionCase.Status);
    }

    private static PerformanceCycle CreateActiveCycle(Guid tenantId, Guid exceptionOwnerId, DateTime now)
    {
        var cycle = PerformanceCycle.Create(tenantId, "FY review", PerformanceCycleType.Annual, now.AddDays(-2), now.AddDays(10));
        cycle.ConfigureGovernance(Guid.NewGuid(), true, 3, CampaignFeedbackVisibility.AnonymousToSubject, [exceptionOwnerId]);
        cycle.BeginAssignmentPreparation(1, now.AddDays(-1));
        cycle.MarkReadyToLaunch(1, 0, true, now.AddHours(-12));
        cycle.Activate(now);
        return cycle;
    }
}
