using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Cycles.Queries;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

/// <summary>
/// D-03 keystone integration test: walks the full governed happy path end-to-end,
/// asserting status transitions and audit events at each step.
/// Seeds a Draft cycle with population via domain methods, then exercises command/query
/// handlers for the key lifecycle transitions: Publish → Curate → Readiness →
/// ReadyToLaunch → Activate → Audit trail.
/// </summary>
public class GovernedHappyPathTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    private sealed class FakeResolver(IReadOnlyList<CoreEmployeeSummary> members) : IPerformancePopulationResolver
    {
        public Task<IReadOnlyList<CoreEmployeeSummary>> ResolveAsync(PerformanceCycle cycle, CancellationToken cancellationToken)
            => Task.FromResult(members);
    }

    [Fact]
    public async Task FullGovernedHappyPath_TransitionsAndAuditEventsAtEveryStep()
    {
        var now = DateTime.UtcNow;
        var tenantContext = new TenantContext();
        tenantContext.SetTenant(TenantId);
        var currentUser = new StubCurrentUserContext();

        var subjectId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var directorId = Guid.NewGuid();
        var exceptionOwnerId = Guid.NewGuid();
        var retentionPolicyId = Guid.NewGuid();

        var members = new List<CoreEmployeeSummary>
        {
            FakeCoreWorkforceClient.Employee(subjectId, "Alice"),
            FakeCoreWorkforceClient.Employee(managerId, "Bob Manager"),
        };
        var workforce = new FakeCoreWorkforceClient
        {
            ResolvePool =
            [
                FakeCoreWorkforceClient.Employee(subjectId, "Alice"),
                FakeCoreWorkforceClient.Employee(managerId, "Bob Manager"),
                FakeCoreWorkforceClient.Employee(directorId, "Director"),
            ]
        };

        // ── Seed: Draft cycle with governance + population configured via domain methods ──
        var cycle = PerformanceCycle.Create(
            TenantId, "FY26 Happy Path", PerformanceCycleType.Annual,
            now.AddDays(-1), now.AddDays(10));
        cycle.ConfigureGovernance(
            retentionPolicyId, false, 3,
            CampaignFeedbackVisibility.AnonymousToSubject,
            [exceptionOwnerId]);
        cycle.SetPopulation(false,
            [PerformanceCyclePopulationRule.Create(TenantId, PopulationRuleType.IncludeEmployee, subjectId, false)]);

        await using var db = PerformanceTestContext.Create(tenantContext);
        db.PerformanceCycles.Add(cycle);
        // Seed audit events for Create + GovernanceConfigured + PopulationUpdated
        db.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            TenantId, cycle.Id, PerformanceCycleAuditAction.Created,
            currentUser.UserId, currentUser.FullName, "Campaign created"));
        db.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            TenantId, cycle.Id, PerformanceCycleAuditAction.GovernanceConfigured,
            currentUser.UserId, currentUser.FullName, "Governance configured"));
        db.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            TenantId, cycle.Id, PerformanceCycleAuditAction.PopulationUpdated,
            currentUser.UserId, currentUser.FullName, "1 rule(s)"));
        await db.SaveChangesAsync();
        var cycleId = cycle.Id;
        var version = cycle.Version;

        // ── Verify seed: audit events for Create, GovernanceConfigured, PopulationUpdated ──
        Assert.True(await db.PerformanceCycleAuditEvents
            .AnyAsync(a => a.CycleId == cycleId && a.Action == PerformanceCycleAuditAction.Created));
        Assert.True(await db.PerformanceCycleAuditEvents
            .AnyAsync(a => a.CycleId == cycleId && a.Action == PerformanceCycleAuditAction.GovernanceConfigured));
        Assert.True(await db.PerformanceCycleAuditEvents
            .AnyAsync(a => a.CycleId == cycleId && a.Action == PerformanceCycleAuditAction.PopulationUpdated));

        // ── Step 1: GetCyclePopulationPreview (live preview while drafting) ──
        var previewHandler = new GetCyclePopulationPreviewQueryHandler(db, new FakeResolver(members));
        var previewResult = await previewHandler.Handle(
            new GetCyclePopulationPreviewQuery(cycleId), CancellationToken.None);

        Assert.True(previewResult.IsSuccess);
        Assert.Equal(2, previewResult.Value.TotalCount);
        Assert.Contains(previewResult.Value.Members, m => m.EmployeeId == subjectId);

        // ── Step 2: PublishCycle (transitions to AssignmentPreparation) ──
        var pubHandler = new PublishCycleCommandHandler(
            db, tenantContext, currentUser,
            new FakeResolver(members), workforce, Options.Create(new ReminderOptions()));
        var pubResult = await pubHandler.Handle(
            new PublishCycleCommand(cycleId, version), CancellationToken.None);

        Assert.True(pubResult.IsSuccess);
        Assert.Equal(PerformanceCycleStatus.AssignmentPreparation.ToString(), pubResult.Value.Status);
        version = pubResult.Value.Version;

        // Participants written + no CyclePublished notification + audit
        Assert.Equal(2, await db.PerformanceCycleParticipants.CountAsync(p => p.CycleId == cycleId));
        Assert.Equal(0, await db.PerformanceNotifications
            .CountAsync(n => n.CycleId == cycleId && n.Type == PerformanceNotificationType.CyclePublished));
        Assert.True(await db.PerformanceCycleAuditEvents
            .AnyAsync(a => a.CycleId == cycleId && a.Action == PerformanceCycleAuditAction.AssignmentPreparationStarted));

        // ── Step 3: CurateCampaignResponsibility ──
        var curateHandler = new CurateCampaignResponsibilityCommandHandler(db, tenantContext, currentUser, workforce);
        var curateResult = await curateHandler.Handle(new CurateCampaignResponsibilityCommand(
            cycleId, version, subjectId, managerId,
            CampaignResponsibilityDuty.ObjectiveApproval, "PrimaryManager", null), CancellationToken.None);

        Assert.True(curateResult.IsSuccess);
        Assert.Equal(managerId, curateResult.Value.Responsibility.AssigneeEmployeeId);
        Assert.Equal(1, curateResult.Value.Responsibility.Revision);
        version = curateResult.Value.CycleVersion;

        // Curate responsibility for Bob Manager (participant) → assignee is Director
        var curateResult2 = await curateHandler.Handle(new CurateCampaignResponsibilityCommand(
            cycleId, version, managerId, directorId,
            CampaignResponsibilityDuty.ObjectiveApproval, "PrimaryManager", null), CancellationToken.None);

        Assert.True(curateResult2.IsSuccess);
        Assert.Equal(directorId, curateResult2.Value.Responsibility.AssigneeEmployeeId);
        version = curateResult2.Value.CycleVersion;

        Assert.True(await db.PerformanceCycleAuditEvents
            .AnyAsync(a => a.CycleId == cycleId && a.Action == PerformanceCycleAuditAction.ResponsibilityCurated));

        // ── Step 4: GetCycleReadiness (0 missing + delta accepted) ──
        var readyHandler = new GetCycleReadinessQueryHandler(db, workforce);
        var readyResult = await readyHandler.Handle(
            new GetCycleReadinessQuery(cycleId), CancellationToken.None);

        Assert.True(readyResult.IsSuccess);
        Assert.Equal(0, readyResult.Value.MissingObjectiveResponsibilityCount);
        Assert.False(readyResult.Value.WorkforceDelta.BlocksLaunch);

        // ── Step 5: MarkCycleReadyToLaunch ──
        var rtlHandler = new MarkCycleReadyToLaunchCommandHandler(
            db, tenantContext, currentUser, workforce, Options.Create(new ReminderOptions()));
        var rtlResult = await rtlHandler.Handle(
            new MarkCycleReadyToLaunchCommand(cycleId, version, true), CancellationToken.None);

        Assert.True(rtlResult.IsSuccess);
        Assert.Equal(PerformanceCycleStatus.ReadyToLaunch.ToString(), rtlResult.Value.Status);
        version = rtlResult.Value.Version;

        Assert.True(await db.PerformanceCycleAuditEvents
            .AnyAsync(a => a.CycleId == cycleId && a.Action == PerformanceCycleAuditAction.ReadyToLaunch));

        // ── Step 6: ActivateCycle ──
        var actHandler = new ActivateCycleCommandHandler(
            db, tenantContext, currentUser, Options.Create(new ReminderOptions()));
        var actResult = await actHandler.Handle(
            new ActivateCycleCommand(cycleId, version), CancellationToken.None);

        Assert.True(actResult.IsSuccess);
        Assert.Equal(PerformanceCycleStatus.Active.ToString(), actResult.Value.Status);

        // Snapshot rows written + audit
        Assert.True(await db.CampaignLaunchParticipantSnapshots
            .AnyAsync(s => s.CycleId == cycleId));
        Assert.True(await db.PerformanceCycleAuditEvents
            .AnyAsync(a => a.CycleId == cycleId && a.Action == PerformanceCycleAuditAction.Activated));

        // ── Step 7: GetCycleAudit (all events present with actor/action/object/time/tenant) ──
        var auditHandler = new GetCycleAuditQueryHandler(db);
        var auditResult = await auditHandler.Handle(
            new GetCycleAuditQuery(cycleId), CancellationToken.None);

        Assert.True(auditResult.IsSuccess);
        var actions = auditResult.Value.Select(e => e.Action).ToList();
        Assert.Contains("Created", actions);
        Assert.Contains("GovernanceConfigured", actions);
        Assert.Contains("PopulationUpdated", actions);
        Assert.Contains("AssignmentPreparationStarted", actions);
        Assert.Contains("ResponsibilityCurated", actions);
        Assert.Contains("ReadyToLaunch", actions);
        Assert.Contains("Activated", actions);

        // Every event carries ActorUserId, Action, OccurredAt
        foreach (var evt in auditResult.Value)
        {
            Assert.NotNull(evt.ActorUserId);
            Assert.NotEqual(Guid.Empty, evt.ActorUserId.Value);
            Assert.True(evt.OccurredAt > DateTime.MinValue);
        }
    }
}
