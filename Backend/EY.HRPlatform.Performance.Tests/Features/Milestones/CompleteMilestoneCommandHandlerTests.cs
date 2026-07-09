using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Milestones.Commands;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Milestones;

public sealed class CompleteMilestoneCommandHandlerTests
{
    [Fact]
    public async Task CompleteMilestone_MarksIsCompleted_AndWritesProgressEntry_WhenModeIsMilestoneRollup()
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
        objective.SetProgressMode(ObjectiveProgressMode.MilestoneRollup);
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();

        var milestone = PerformanceObjectiveMilestone.Create(tenantId, objective.Id, "Complete pilot", DateTime.UtcNow.AddDays(10));
        db.PerformanceObjectiveMilestones.Add(milestone);
        await db.SaveChangesAsync();

        var handler = new CompleteMilestoneCommandHandler(db, new StubCurrentUserContext { EmployeeId = ownerEmployeeId });
        var result = await handler.Handle(new CompleteMilestoneCommand(milestone.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);

        // Verify milestone completed
        var completedMilestone = await db.PerformanceObjectiveMilestones.SingleAsync(m => m.Id == milestone.Id);
        Assert.True(completedMilestone.IsCompleted);
        Assert.NotNull(completedMilestone.CompletedAt);

        // Verify append-only progress entry written (D-14)
        var entry = Assert.Single(db.ObjectiveProgressEntries);
        Assert.Equal(objective.Id, entry.ObjectiveId);
        Assert.Equal("OwnerUpdate", entry.Source);
        Assert.Equal(ObjectiveProgressMode.MilestoneRollup, entry.Mode);
    }

    [Fact]
    public async Task CompleteMilestone_ReturnsForbidden_ForNonOwner()
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

        var milestone = PerformanceObjectiveMilestone.Create(tenantId, objective.Id, "Complete pilot", DateTime.UtcNow.AddDays(10));
        db.PerformanceObjectiveMilestones.Add(milestone);
        await db.SaveChangesAsync();

        var nonOwnerId = Guid.NewGuid();
        var handler = new CompleteMilestoneCommandHandler(db, new StubCurrentUserContext { EmployeeId = nonOwnerId });
        var result = await handler.Handle(new CompleteMilestoneCommand(milestone.Id), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotOwner", result.Error.Code);
    }

    [Fact]
    public async Task CompleteMilestone_EmitsZeroGovernanceAuditEvents()
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
        objective.SetProgressMode(ObjectiveProgressMode.MilestoneRollup);
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();

        var milestone = PerformanceObjectiveMilestone.Create(tenantId, objective.Id, "Complete pilot", DateTime.UtcNow.AddDays(10));
        db.PerformanceObjectiveMilestones.Add(milestone);
        await db.SaveChangesAsync();

        var handler = new CompleteMilestoneCommandHandler(db, new StubCurrentUserContext { EmployeeId = ownerEmployeeId });
        await handler.Handle(new CompleteMilestoneCommand(milestone.Id), CancellationToken.None);

        // D-14: routine owner milestone complete does NOT emit governance audit events
        Assert.Empty(db.PerformanceCycleAuditEvents.Where(a => a.Action == PerformanceCycleAuditAction.ObjectiveProgressCorrected));
    }

    [Fact]
    public async Task CompleteMilestone_ReturnsNotFound_WhenMilestoneDoesNotExist()
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

        var handler = new CompleteMilestoneCommandHandler(db, new StubCurrentUserContext { EmployeeId = ownerEmployeeId });
        var result = await handler.Handle(new CompleteMilestoneCommand(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }
}
