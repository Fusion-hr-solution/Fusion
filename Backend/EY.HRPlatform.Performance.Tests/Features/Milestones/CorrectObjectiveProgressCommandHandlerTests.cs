using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Milestones.Commands;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Xunit;

namespace EY.HRPlatform.Performance.Tests.Features.Milestones;

public class CorrectObjectiveProgressCommandHandlerTests
{
    private sealed class StubAccessPolicy : IPerformanceAccessPolicyService
    {
        public bool CanCorrectObjectiveProgress(ClaimsPrincipal user) => true;
        // All other methods stub to default — not used in these tests
        public bool CanViewCycles(ClaimsPrincipal user) => false;
        public bool CanManageCycles(ClaimsPrincipal user) => false;
        public bool CanOperateCycles(ClaimsPrincipal user) => false;
        public bool CanViewStrategicObjectives(ClaimsPrincipal user) => false;
        public bool CanManageStrategicObjectives(ClaimsPrincipal user) => false;
        public bool CanPublishStrategicObjectives(ClaimsPrincipal user) => false;
        public bool CanViewCollectiveObjectives(ClaimsPrincipal user) => false;
        public bool CanApproveCollectiveObjectives(ClaimsPrincipal user) => false;
        public bool CanAccessConfidentialFeedbackIdentity(ClaimsPrincipal user) => false;
        public bool CanViewFeedbackThresholdDetails(ClaimsPrincipal user) => false;
    }

    private sealed class StubHttpContextAccessor : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get; set; } = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())]))
        };
    }

    [Fact]
    public async Task CorrectProgress_ValidRequest_OverridesProgressAndEmitsAudit()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var managerEmpId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var cycle = TestCycles.Create(tenantId, "FY26", PerformanceCycleType.Annual, now.AddDays(-1), now.AddDays(30));
        cycle.ConfigureForAssignmentPreparation();
        cycle.BeginAssignmentPreparation(1, now);
        cycle.MarkReadyToLaunch(1, 0, true, now);
        cycle.Activate(now);
        db.PerformanceCycles.Add(cycle);

        var objective = PerformanceObjective.Create(tenantId, cycle.Id, ObjectiveLevel.Individual, ownerEmployeeId, "Improve onboarding", null, "Completion", "100%", now.AddDays(7), 20);
        objective.Submit(now);
        objective.Approve(now);
        objective.SetManualProgress(40m, now);
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();

        var handler = new CorrectObjectiveProgressCommandHandler(
            db,
            new StubCurrentUserContext { EmployeeId = managerEmpId },
            new StubAccessPolicy(),
            new StubHttpContextAccessor());

        // Act
        var result = await handler.Handle(
            new CorrectObjectiveProgressCommand(objective.Id, 80m, "Verified in person review"),
            CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);

        var updatedObjective = await db.PerformanceObjectives.SingleAsync(o => o.Id == objective.Id);
        Assert.Equal(80m, updatedObjective.ManualProgressPercent);

        var entry = Assert.Single(db.ObjectiveProgressEntries);
        Assert.Equal(objective.Id, entry.ObjectiveId);
        Assert.Equal(40m, entry.PreviousPercent);
        Assert.Equal(80m, entry.NewPercent);
        Assert.Equal("ManagerCorrection", entry.Source);
        Assert.Equal("Verified in person review", entry.Comment);

        var auditEvent = Assert.Single(db.PerformanceCycleAuditEvents
            .Where(e => e.Action == PerformanceCycleAuditAction.ObjectiveProgressCorrected));
        Assert.Contains("Corrected progress from", auditEvent.Details);
    }

    [Fact]
    public async Task CorrectProgress_NoReason_ReturnsValidation()
    {
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var cycle = TestCycles.Create(tenantId, "FY26", PerformanceCycleType.Annual, now.AddDays(-1), now.AddDays(30));
        cycle.ConfigureForAssignmentPreparation();
        cycle.BeginAssignmentPreparation(1, now);
        cycle.MarkReadyToLaunch(1, 0, true, now);
        cycle.Activate(now);
        db.PerformanceCycles.Add(cycle);

        var objective = PerformanceObjective.Create(tenantId, cycle.Id, ObjectiveLevel.Individual, ownerEmployeeId, "Improve onboarding", null, "Completion", "100%", now.AddDays(7), 20);
        objective.Submit(now);
        objective.Approve(now);
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();

        var handler = new CorrectObjectiveProgressCommandHandler(
            db,
            new StubCurrentUserContext { EmployeeId = Guid.NewGuid() },
            new StubAccessPolicy(),
            new StubHttpContextAccessor());

        // Act — null reason
        var result = await handler.Handle(new CorrectObjectiveProgressCommand(objective.Id, 80m, null!), CancellationToken.None);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("ReasonRequired", result.Error.Code);
    }

    [Fact]
    public async Task CorrectProgress_CorrectsMilestoneRollupMode()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var cycle = TestCycles.Create(tenantId, "FY26", PerformanceCycleType.Annual, now.AddDays(-1), now.AddDays(30));
        cycle.ConfigureForAssignmentPreparation();
        cycle.BeginAssignmentPreparation(1, now);
        cycle.MarkReadyToLaunch(1, 0, true, now);
        cycle.Activate(now);
        db.PerformanceCycles.Add(cycle);

        var objective = PerformanceObjective.Create(tenantId, cycle.Id, ObjectiveLevel.Individual, ownerEmployeeId, "Improve onboarding", null, "Completion", "100%", now.AddDays(7), 20);
        objective.Submit(now);
        objective.Approve(now);
        objective.SetProgressMode(ObjectiveProgressMode.MilestoneRollup);
        db.PerformanceObjectives.Add(objective);

        // Add two milestones, complete one
        var m1 = PerformanceObjectiveMilestone.Create(tenantId, objective.Id, "M1", now.AddDays(5));
        var m2 = PerformanceObjectiveMilestone.Create(tenantId, objective.Id, "M2", now.AddDays(10));
        m1.Complete(now);
        db.PerformanceObjectiveMilestones.AddRange(m1, m2);
        await db.SaveChangesAsync();

        var handler = new CorrectObjectiveProgressCommandHandler(
            db,
            new StubCurrentUserContext { EmployeeId = Guid.NewGuid() },
            new StubAccessPolicy(),
            new StubHttpContextAccessor());

        // Act — manager corrects to override MilestoneRollup with manual 90%
        var result = await handler.Handle(
            new CorrectObjectiveProgressCommand(objective.Id, 90m, "Override milestone tracking based on external review"),
            CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);

        var updatedObjective = await db.PerformanceObjectives.SingleAsync(o => o.Id == objective.Id);
        Assert.Equal(ObjectiveProgressMode.ManualPercent, updatedObjective.ProgressMode);
        Assert.Equal(90m, updatedObjective.ManualProgressPercent);

        var entry = Assert.Single(db.ObjectiveProgressEntries);
        Assert.Equal("ManagerCorrection", entry.Source);
        Assert.Equal(ObjectiveProgressMode.MilestoneRollup, entry.Mode);
    }

    [Fact]
    public async Task CorrectProgress_ObjectiveNotFound_ReturnsNotFound()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var handler = new CorrectObjectiveProgressCommandHandler(
            db,
            new StubCurrentUserContext { EmployeeId = Guid.NewGuid() },
            new StubAccessPolicy(),
            new StubHttpContextAccessor());

        // Act
        var result = await handler.Handle(
            new CorrectObjectiveProgressCommand(Guid.NewGuid(), 50m, "reason"),
            CancellationToken.None);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("NotFound", result.Error.Code);
    }
}
