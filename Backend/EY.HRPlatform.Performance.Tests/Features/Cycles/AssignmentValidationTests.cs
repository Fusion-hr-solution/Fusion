using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

/// <summary>
/// D-08: assignment-matrix validation coverage — manager-chain cycle detection,
/// conflict/duplicate handling via the revision model, and unknown-subject rejection.
/// </summary>
public sealed class AssignmentValidationTests
{
    /// <summary>
    /// An approval chain cycle (A→B→C→A) must be rejected with Cycle.ApprovalChainCycle.
    /// </summary>
    [Fact]
    public async Task ManagerChainCycle_IsRejected()
    {
        // Arrange — seed a cycle with three participants forming a chain: A approves B, B approves C
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var employeeA = Guid.NewGuid();
        var employeeB = Guid.NewGuid();
        var employeeC = Guid.NewGuid();

        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual,
            now.AddDays(-1), now.AddDays(10));
        cycle.ConfigureForAssignmentPreparation();
        cycle.BeginAssignmentPreparation(1, now);
        db.PerformanceCycles.Add(cycle);
        db.PerformanceCycleParticipants.Add(
            PerformanceCycleParticipant.Create(tenantId, cycle.Id, employeeA, "Alice"));
        db.PerformanceCycleParticipants.Add(
            PerformanceCycleParticipant.Create(tenantId, cycle.Id, employeeB, "Bob"));
        db.PerformanceCycleParticipants.Add(
            PerformanceCycleParticipant.Create(tenantId, cycle.Id, employeeC, "Carol"));
        await db.SaveChangesAsync();

        var workforce = new FakeCoreWorkforceClient
        {
            ResolvePool =
            [
                FakeCoreWorkforceClient.Employee(employeeA, "Alice"),
                FakeCoreWorkforceClient.Employee(employeeB, "Bob"),
                FakeCoreWorkforceClient.Employee(employeeC, "Carol"),
            ]
        };

        // Act — curate A→B, B→C, then attempt C→A (creates a cycle)
        var handler = new CurateCampaignResponsibilityCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), workforce);

        // A approves B
        await handler.Handle(new CurateCampaignResponsibilityCommand(
            cycle.Id, cycle.Version, employeeA, employeeB,
            CampaignResponsibilityDuty.ObjectiveApproval, "PrimaryManager", null), CancellationToken.None);

        // B approves C
        await handler.Handle(new CurateCampaignResponsibilityCommand(
            cycle.Id, cycle.Version, employeeB, employeeC,
            CampaignResponsibilityDuty.ObjectiveApproval, "PrimaryManager", null), CancellationToken.None);

        // C approves A — should be rejected as a cycle
        var result = await handler.Handle(new CurateCampaignResponsibilityCommand(
            cycle.Id, cycle.Version, employeeC, employeeA,
            CampaignResponsibilityDuty.ObjectiveApproval, "PrimaryManager", null), CancellationToken.None);

        // Assert — cycle detection rejects the curation
        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.ApprovalChainCycle", result.Error.Code);
    }

    /// <summary>
    /// Curating the same subject+duty twice produces a new revision (Revision 2)
    /// and the first row is no longer IsFinal — conflict/duplicate handled by the
    /// revision model, not as an error.
    /// </summary>
    [Fact]
    public async Task DuplicateSubjectDuty_SupersedesViaRevision()
    {
        // Arrange — seed a cycle with two possible assignees for the same subject
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var subjectId = Guid.NewGuid();
        var assigneeA = Guid.NewGuid();
        var assigneeB = Guid.NewGuid();

        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual,
            now.AddDays(-1), now.AddDays(10));
        cycle.ConfigureForAssignmentPreparation();
        cycle.BeginAssignmentPreparation(1, now);
        db.PerformanceCycles.Add(cycle);
        db.PerformanceCycleParticipants.Add(
            PerformanceCycleParticipant.Create(tenantId, cycle.Id, subjectId, "Employee"));
        await db.SaveChangesAsync();

        var workforce = new FakeCoreWorkforceClient
        {
            ResolvePool =
            [
                FakeCoreWorkforceClient.Employee(subjectId, "Employee"),
                FakeCoreWorkforceClient.Employee(assigneeA, "Manager A"),
                FakeCoreWorkforceClient.Employee(assigneeB, "Manager B"),
            ]
        };

        var handler = new CurateCampaignResponsibilityCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), workforce);

        // Act — curate same subject+duty twice with different assignees
        var first = await handler.Handle(new CurateCampaignResponsibilityCommand(
            cycle.Id, cycle.Version, subjectId, assigneeA,
            CampaignResponsibilityDuty.ObjectiveApproval, "PrimaryManager", null), CancellationToken.None);

        var second = await handler.Handle(new CurateCampaignResponsibilityCommand(
            cycle.Id, cycle.Version, subjectId, assigneeB,
            CampaignResponsibilityDuty.ObjectiveApproval, "SecondaryManager", "Override"), CancellationToken.None);

        // Assert — second revision supersedes the first
        Assert.True(first.IsSuccess);
        Assert.Equal(1, first.Value.Responsibility.Revision);
        Assert.True(second.IsSuccess);
        Assert.Equal(2, second.Value.Responsibility.Revision);
        Assert.Equal(assigneeB, second.Value.Responsibility.AssigneeEmployeeId);

        // First row is no longer IsFinal
        var firstRow = db.CampaignAssignmentResponsibilities
            .Single(r => r.Id == first.Value.Responsibility.Id);
        Assert.False(firstRow.IsFinal);

        // Second row is IsFinal
        var secondRow = db.CampaignAssignmentResponsibilities
            .Single(r => r.Id == second.Value.Responsibility.Id);
        Assert.True(secondRow.IsFinal);
    }

    /// <summary>
    /// A subject not present in cycle.Participants must be rejected with Cycle.UnknownSubject.
    /// </summary>
    [Fact]
    public async Task UnknownSubject_IsRejected()
    {
        // Arrange — seed a cycle with one participant, try to curate a responsibility
        // for a subject not in the cycle
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var participantId = Guid.NewGuid();
        var unknownSubject = Guid.NewGuid();
        var assigneeId = Guid.NewGuid();

        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual,
            now.AddDays(-1), now.AddDays(10));
        cycle.ConfigureForAssignmentPreparation();
        cycle.BeginAssignmentPreparation(1, now);
        db.PerformanceCycles.Add(cycle);
        db.PerformanceCycleParticipants.Add(
            PerformanceCycleParticipant.Create(tenantId, cycle.Id, participantId, "Known Employee"));
        await db.SaveChangesAsync();

        var workforce = new FakeCoreWorkforceClient
        {
            ResolvePool =
            [
                FakeCoreWorkforceClient.Employee(participantId, "Known Employee"),
                FakeCoreWorkforceClient.Employee(unknownSubject, "Unknown"),
                FakeCoreWorkforceClient.Employee(assigneeId, "Manager"),
            ]
        };

        var handler = new CurateCampaignResponsibilityCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), workforce);

        // Act — curate a responsibility for a subject not in cycle.Participants
        var result = await handler.Handle(new CurateCampaignResponsibilityCommand(
            cycle.Id, cycle.Version, unknownSubject, assigneeId,
            CampaignResponsibilityDuty.ObjectiveApproval, "PrimaryManager", null), CancellationToken.None);

        // Assert — unknown subject is rejected
        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.UnknownSubject", result.Error.Code);
    }
}
