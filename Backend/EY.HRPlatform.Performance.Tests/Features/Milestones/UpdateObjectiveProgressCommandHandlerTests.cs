using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Milestones.Commands;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EY.HRPlatform.Performance.Tests.Features.Milestones;

public class UpdateObjectiveProgressCommandHandlerTests
{
    [Fact]
    public async Task UpdateProgress_ValidRequest_StoresProgressAndHistory()
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
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();

        var handler = new UpdateObjectiveProgressCommandHandler(db, new StubCurrentUserContext { EmployeeId = ownerEmployeeId });
        var command = new UpdateObjectiveProgressCommand(objective.Id, 55m, "Midpoint check");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);

        var updatedObjective = await db.PerformanceObjectives.SingleAsync(o => o.Id == objective.Id);
        Assert.Equal(55m, updatedObjective.ManualProgressPercent);

        var entry = Assert.Single(db.ObjectiveProgressEntries);
        Assert.Equal(objective.Id, entry.ObjectiveId);
        Assert.Null(entry.PreviousPercent);
        Assert.Equal(55m, entry.NewPercent);
        Assert.Equal("OwnerUpdate", entry.Source);
        Assert.Equal("Midpoint check", entry.Comment);
    }

    [Fact]
    public async Task UpdateProgress_NotOwner_ReturnsForbidden()
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
        var handler = new UpdateObjectiveProgressCommandHandler(db, new StubCurrentUserContext { EmployeeId = nonOwnerId });

        // Act
        var result = await handler.Handle(new UpdateObjectiveProgressCommand(objective.Id, 50m, null), CancellationToken.None);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("NotOwner", result.Error.Code);
    }

    [Fact]
    public async Task UpdateProgress_MilestoneRollupMode_ReturnsConflict()
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

        var handler = new UpdateObjectiveProgressCommandHandler(db, new StubCurrentUserContext { EmployeeId = ownerEmployeeId });

        // Act
        var result = await handler.Handle(new UpdateObjectiveProgressCommand(objective.Id, 75m, null), CancellationToken.None);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("ModeMismatch", result.Error.Code);
    }

    [Fact]
    public async Task UpdateProgress_ObjectiveNotApproved_ReturnsConflict()
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
        // Leave as Draft (not approved)
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();

        var handler = new UpdateObjectiveProgressCommandHandler(db, new StubCurrentUserContext { EmployeeId = ownerEmployeeId });

        // Act
        var result = await handler.Handle(new UpdateObjectiveProgressCommand(objective.Id, 50m, null), CancellationToken.None);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("ObjectiveNotApproved", result.Error.Code);
    }

    [Fact]
    public async Task UpdateProgress_PercentOutOfRange_ReturnsValidation()
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

        var handler = new UpdateObjectiveProgressCommandHandler(db, new StubCurrentUserContext { EmployeeId = ownerEmployeeId });

        // Act
        var result = await handler.Handle(new UpdateObjectiveProgressCommand(objective.Id, 150m, null), CancellationToken.None);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("InvalidPercent", result.Error.Code);
    }
}
