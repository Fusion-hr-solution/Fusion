using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Features.Cycles.Queries;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

/// <summary>
/// D-04 guardrail 2: mid-cycle Core changes surface a delta and never silently
/// regenerate curated responsibilities. The apply/reject path targets only the
/// explicitly listed snapshot row.
/// </summary>
public sealed class WorkforceDeltaReconciliationTests
{
    /// <summary>
    /// When a Core assignee becomes inactive mid-cycle, the delta resolver surfaces
    /// the change — but the curated CampaignAssignmentResponsibility row must remain
    /// byte-for-byte unchanged (no silent regen).
    /// </summary>
    [Fact]
    public async Task MidCycleCoreChange_SurfacesDelta_NotSilentRegen()
    {
        // Arrange — seed an Active cycle with one launch snapshot + one final curated responsibility
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var subjectId = Guid.NewGuid();
        var managerId = Guid.NewGuid();

        var dbName = $"perf-delta-{Guid.NewGuid()}";
        var tenantContext = new TenantContext();
        tenantContext.SetTenant(tenantId);

        // Seed: cycle reaching Active state with one participant and one curated responsibility
        await using (var seed = PerformanceTestContext.Create(tenantContext, dbName))
        {
            var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual,
                now.AddDays(-1), now.AddDays(10), now.AddDays(3));
            cycle.ConfigureGovernance(Guid.NewGuid(), false, 3,
                CampaignFeedbackVisibility.AnonymousToSubject, [Guid.NewGuid()]);
            cycle.BeginAssignmentPreparation(1, now);
            cycle.MarkReadyToLaunch(1, 0, true, now);

            seed.PerformanceCycles.Add(cycle);
            seed.PerformanceCycleParticipants.Add(
                PerformanceCycleParticipant.Create(tenantId, cycle.Id, subjectId, "Employee"));
            seed.CampaignAssignmentResponsibilities.Add(
                CampaignAssignmentResponsibility.Confirm(
                    tenantId, cycle.Id, subjectId, managerId, "Manager",
                    CampaignResponsibilityDuty.ObjectiveApproval,
                    CampaignAssignmentSource.Curated, "PrimaryManager"));
            await seed.SaveChangesAsync();

            // Activate the cycle so snapshots exist
            cycle.Activate(now);
            seed.CampaignLaunchParticipantSnapshots.Add(
                CampaignLaunchParticipantSnapshot.FromPreparationCandidate(
                    seed.PerformanceCycleParticipants.Single(p => p.EmployeeId == subjectId), now));
            await seed.SaveChangesAsync();
        }

        // Act — mutate FakeCoreWorkforceClient to mark the assignee inactive, then compute delta
        var workforce = new FakeCoreWorkforceClient
        {
            ResolvePool =
            [
                FakeCoreWorkforceClient.Employee(subjectId, "Employee"),
                FakeCoreWorkforceClient.Employee(managerId, "Manager") with { IsActive = false },
            ]
        };

        // Build the delta-resolver input from the seeded responsibility items
        await using var db = PerformanceTestContext.Create(tenantContext, dbName);
        var cycleId = await db.PerformanceCycles.Select(c => c.Id).SingleAsync();
        var items = await db.CampaignAssignmentResponsibilities
            .Where(r => r.CycleId == cycleId)
            .Join(db.PerformanceCycleParticipants,
                r => new { r.CycleId, r.SubjectEmployeeId },
                p => new { p.CycleId, SubjectEmployeeId = p.EmployeeId },
                (r, p) => new CampaignResponsibilityWorkItemDto(
                    p.Id, r.SubjectEmployeeId, p.FullName, p.OrgUnitName,
                    p.JobTitle, null,
                    new CampaignResponsibilitySummaryDto(
                        r.Id, r.AssigneeEmployeeId, r.AssigneeName, r.Duty.ToString(),
                        r.Source.ToString(), r.RelationshipSource, r.OverrideReason,
                        r.Revision, r.RecordedAt)))
            .ToListAsync();

        var delta = await CampaignWorkforceDeltaResolver.ComputeAsync(items, workforce, CancellationToken.None);

        // Assert — delta is surfaced (blocking because assignee is inactive)
        Assert.True(delta.BlocksLaunch);
        Assert.Contains(delta.Items, d => d.AssigneeEmployeeId == managerId);

        // Assert — curated responsibility row is UNCHANGED (no silent regen)
        await using var verify = PerformanceTestContext.Create(tenantContext, dbName);
        var responsibility = await verify.CampaignAssignmentResponsibilities
            .SingleAsync(r => r.CycleId == cycleId && r.SubjectEmployeeId == subjectId);
        Assert.Equal(managerId, responsibility.AssigneeEmployeeId);
        Assert.Equal(1, responsibility.Revision);
        Assert.True(responsibility.IsFinal);
        Assert.Equal("Manager", responsibility.AssigneeName);
    }

    /// <summary>
    /// When an authorized owner accepts a delta item, ApplyWorkforceDelta patches only
    /// the targeted snapshot row and emits a WorkforceDeltaApplied audit event.
    /// </summary>
    [Fact]
    public async Task ApplyDelta_PatchesOnlyTargetedRow_LeavesOthersUntouched()
    {
        // Arrange — seed an Active cycle with two responsibilities / snapshot rows
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var subjectA = Guid.NewGuid();
        var subjectB = Guid.NewGuid();
        var assigneeA = Guid.NewGuid();
        var assigneeB = Guid.NewGuid();

        var dbName = $"perf-apply-{Guid.NewGuid()}";
        var tenantContext = new TenantContext();
        tenantContext.SetTenant(tenantId);

        await using (var seed = PerformanceTestContext.Create(tenantContext, dbName))
        {
            var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual,
                now.AddDays(-1), now.AddDays(10), now.AddDays(3));
            cycle.ConfigureGovernance(Guid.NewGuid(), false, 3,
                CampaignFeedbackVisibility.AnonymousToSubject, [Guid.NewGuid()]);
            cycle.BeginAssignmentPreparation(1, now);
            cycle.MarkReadyToLaunch(1, 0, true, now);

            seed.PerformanceCycles.Add(cycle);
            seed.PerformanceCycleParticipants.Add(
                PerformanceCycleParticipant.Create(tenantId, cycle.Id, subjectA, "Employee A"));
            seed.PerformanceCycleParticipants.Add(
                PerformanceCycleParticipant.Create(tenantId, cycle.Id, subjectB, "Employee B"));
            seed.CampaignAssignmentResponsibilities.Add(
                CampaignAssignmentResponsibility.Confirm(
                    tenantId, cycle.Id, subjectA, assigneeA, "Manager A",
                    CampaignResponsibilityDuty.ObjectiveApproval,
                    CampaignAssignmentSource.Curated, "PrimaryManager"));
            seed.CampaignAssignmentResponsibilities.Add(
                CampaignAssignmentResponsibility.Confirm(
                    tenantId, cycle.Id, subjectB, assigneeB, "Manager B",
                    CampaignResponsibilityDuty.ObjectiveApproval,
                    CampaignAssignmentSource.Curated, "PrimaryManager"));
            await seed.SaveChangesAsync();

            cycle.Activate(now);
            var participants = await seed.PerformanceCycleParticipants.ToListAsync();
            foreach (var p in participants)
                seed.CampaignLaunchParticipantSnapshots.Add(
                    CampaignLaunchParticipantSnapshot.FromPreparationCandidate(p, now));
            await seed.SaveChangesAsync();
        }

        // Act — dispatch ApplyWorkforceDeltaCommand accepting only the first item
        // NOTE: ApplyWorkforceDeltaCommand / WorkforceDeltaDecision / ApplyWorkforceDeltaResultDto
        //       do NOT exist yet — this test is RED until plan 04 builds them.
        await using var db = PerformanceTestContext.Create(tenantContext, dbName);
        var cycleId = await db.PerformanceCycles.Select(c => c.Id).SingleAsync();
        var responsibilities = await db.CampaignAssignmentResponsibilities
            .Where(r => r.CycleId == cycleId)
            .OrderBy(r => r.SubjectEmployeeId)
            .ToListAsync();

        var firstResponsibilityId = responsibilities[0].Id;

        var handler = new ApplyWorkforceDeltaCommandHandler(
            db, tenantContext, new StubCurrentUserContext());

        var command = new ApplyWorkforceDeltaCommand(cycleId, db.PerformanceCycles.Single().Version,
            [new WorkforceDeltaDecision(firstResponsibilityId, Accept: true, Reason: null)]);

        var result = await handler.Handle(command, CancellationToken.None);

        // Assert — success
        Assert.True(result.IsSuccess);

        // Assert — one audit event with WorkforceDeltaApplied
        Assert.Contains(db.PerformanceCycleAuditEvents,
            a => a.CycleId == cycleId
              && a.Action == PerformanceCycleAuditAction.WorkforceDeltaApplied);

        // Assert — the targeted row was patched, the other row is untouched
        await using var verify = PerformanceTestContext.Create(tenantContext, dbName);
        var updated = await verify.CampaignAssignmentResponsibilities
            .SingleAsync(r => r.Id == firstResponsibilityId);
        Assert.True(updated.IsFinal);

        var untouched = await verify.CampaignAssignmentResponsibilities
            .SingleAsync(r => r.Id == responsibilities[1].Id);
        Assert.Equal(assigneeB, untouched.AssigneeEmployeeId);
        Assert.Equal(1, untouched.Revision);
        Assert.True(untouched.IsFinal);
    }
}
