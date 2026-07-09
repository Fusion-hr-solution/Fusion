using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Milestones.Commands;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Milestones;

public sealed class AddMilestoneCommandHandlerTests
{
    [Fact]
    public async Task AddMilestone_SucceedsForOwner_WhenObjectiveApprovedAndCampaignActive()
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

        var handler = new AddMilestoneCommandHandler(db, new StubCurrentUserContext { EmployeeId = ownerEmployeeId });
        var result = await handler.Handle(new AddMilestoneCommand(objective.Id, "Complete pilot", DateTime.UtcNow.AddDays(5)), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var milestone = Assert.Single(db.PerformanceObjectiveMilestones);
        Assert.Equal("Complete pilot", milestone.Title);
        Assert.False(milestone.IsCompleted);
    }

    [Fact]
    public async Task AddMilestone_ReturnsForbidden_ForNonOwner()
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

        var nonOwnerId = Guid.NewGuid();
        var handler = new AddMilestoneCommandHandler(db, new StubCurrentUserContext { EmployeeId = nonOwnerId });
        var result = await handler.Handle(new AddMilestoneCommand(objective.Id, "Should fail", DateTime.UtcNow.AddDays(5)), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotOwner", result.Error.Code);
    }

    [Fact]
    public async Task AddMilestone_ReturnsForbidden_WhenNoEmployeeContext()
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

        var handler = new AddMilestoneCommandHandler(db, new StubCurrentUserContext { EmployeeId = null });
        var result = await handler.Handle(new AddMilestoneCommand(objective.Id, "Should fail", DateTime.UtcNow.AddDays(5)), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("EmployeeContextRequired", result.Error.Code);
    }

    [Fact]
    public async Task AddMilestone_ReturnsNotFound_WhenObjectiveDoesNotExist()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var ownerEmployeeId = Guid.NewGuid();

        var handler = new AddMilestoneCommandHandler(db, new StubCurrentUserContext { EmployeeId = ownerEmployeeId });
        var result = await handler.Handle(new AddMilestoneCommand(Guid.NewGuid(), "Should fail", DateTime.UtcNow.AddDays(5)), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task AddMilestone_EmitsZeroGovernanceAuditEvents()
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

        var handler = new AddMilestoneCommandHandler(db, new StubCurrentUserContext { EmployeeId = ownerEmployeeId });
        await handler.Handle(new AddMilestoneCommand(objective.Id, "Milestone 1", DateTime.UtcNow.AddDays(5)), CancellationToken.None);

        // D-14: routine owner milestone add does NOT emit governance audit events
        Assert.Empty(db.PerformanceCycleAuditEvents.Where(a => a.Action == PerformanceCycleAuditAction.ObjectiveProgressCorrected));
    }
}
