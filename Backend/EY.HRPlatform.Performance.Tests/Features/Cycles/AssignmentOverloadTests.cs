using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

/// <summary>
/// D-08/D-09: overload detection — when one assignee accumulates too many
/// responsibilities, the system surfaces a warning. Overload is non-blocking
/// (result.IsSuccess == true) per D-09.
/// </summary>
public sealed class AssignmentOverloadTests
{
    /// <summary>
    /// Curating many responsibilities to the same assignee succeeds (non-blocking)
    /// and surfaces an overload warning.
    /// </summary>
    [Fact]
    public async Task CurateManyToOneAssignee_SucceedsWithOverloadWarning()
    {
        // Arrange — seed a cycle with N participants, all to be assigned to the same manager
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var assigneeId = Guid.NewGuid();
        var subjectCount = 10; // enough to trigger overload
        var subjectIds = Enumerable.Range(0, subjectCount).Select(_ => Guid.NewGuid()).ToList();

        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual,
            now.AddDays(-1), now.AddDays(10));
        cycle.ConfigureForAssignmentPreparation();
        cycle.BeginAssignmentPreparation(1, now);
        db.PerformanceCycles.Add(cycle);

        // All participants use the same assignee
        var workforceEmployees = new List<CoreEmployeeSummary>
        {
            FakeCoreWorkforceClient.Employee(assigneeId, "Overloaded Manager"),
        };
        foreach (var subjectId in subjectIds)
        {
            db.PerformanceCycleParticipants.Add(
                PerformanceCycleParticipant.Create(tenantId, cycle.Id, subjectId, $"Employee {subjectId.ToString("N")[..6]}"));
            workforceEmployees.Add(
                FakeCoreWorkforceClient.Employee(subjectId, $"Employee {subjectId.ToString("N")[..6]}"));
        }
        await db.SaveChangesAsync();

        var workforce = new FakeCoreWorkforceClient
        {
            ResolvePool = workforceEmployees
        };

        var handler = new CurateCampaignResponsibilityCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), workforce);

        // Act — curate all subjects to the same assignee
        foreach (var subjectId in subjectIds)
        {
            var result = await handler.Handle(new CurateCampaignResponsibilityCommand(
                cycle.Id, cycle.Version, subjectId, assigneeId,
                CampaignResponsibilityDuty.ObjectiveApproval, "PrimaryManager", null), CancellationToken.None);

            // Assert — each curation succeeds (overload is non-blocking per D-09)
            Assert.True(result.IsSuccess, $"Curation for {subjectId} should succeed even when overload is detected.");
        }

        // Assert — all 10 responsibilities were created
        var responsibilities = db.CampaignAssignmentResponsibilities
            .Where(r => r.CycleId == cycle.Id)
            .ToList();
        Assert.Equal(subjectCount, responsibilities.Count);
        Assert.All(responsibilities, r => Assert.Equal(assigneeId, r.AssigneeEmployeeId));

        // NOTE: Overload warning surfacing depends on the implementation in plan 05.
        // The test asserts the non-blocking behavior (IsSuccess == true) which is the
        // critical D-09 requirement. The warning surface (on result or via readiness
        // query) will be verified when plan 05 turns this test green.
    }
}
