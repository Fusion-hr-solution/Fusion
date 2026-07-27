using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Infrastructure.Jobs;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

/// <summary>
/// The automatic-closure condition (design D3): a campaign closes once every non-excluded manager
/// assessment is finalized. Acknowledgement never gates it, and a campaign with no launched round
/// never closes by itself.
/// </summary>
public sealed class CampaignClosureAutomationTests
{
    private sealed record Scenario(Guid TenantId, string DbName, Guid CampaignId, Guid RoundId);

    /// <summary>Seeds a launched round and drives every manager assessment to the given status.</summary>
    private static async Task<Scenario> SeedAsync(EvaluationAssignmentStatus managerStatus)
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"closure-automation-{Guid.NewGuid()}";

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var seeded = await EvaluationTestScenario.SeedAndLaunchFreshAsync(db, tenantId);

        foreach (var assignment in await db.EvaluationAssignments
                     .Where(a => a.RoundId == seeded.RoundId
                                 && a.Kind == EvaluationAssignmentKind.ManagerAssessment)
                     .ToListAsync())
        {
            assignment.ForceStatus(managerStatus);
        }

        await db.SaveChangesAsync();
        return new Scenario(tenantId, dbName, seeded.CampaignId, seeded.RoundId);
    }

    private static async Task<bool> IsEligibleAsync(Scenario scenario)
    {
        await using var db = PerformanceTestContext.Create(scenario.TenantId, out _, scenario.DbName);
        return await new CampaignClosureEligibilityResolver(db)
            .IsEligibleForAutomaticClosureAsync(scenario.CampaignId, CancellationToken.None);
    }

    private static async Task CloseAsync(Scenario scenario, CampaignClosureKind kind)
    {
        await using var db = PerformanceTestContext.Create(scenario.TenantId, out var tenant, scenario.DbName);
        await new CampaignCloser(db, tenant).StageCloseAsync(
            scenario.CampaignId, kind, Guid.NewGuid(), "HR Admin", DateTime.UtcNow, CancellationToken.None);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task A_campaign_becomes_eligible_once_every_manager_assessment_is_finalized()
    {
        var scenario = await SeedAsync(EvaluationAssignmentStatus.Finalized);

        Assert.True(await IsEligibleAsync(scenario));
    }

    [Fact]
    public async Task One_unfinalized_manager_assessment_holds_the_campaign_open()
    {
        var scenario = await SeedAsync(EvaluationAssignmentStatus.Finalized);

        await using (var db = PerformanceTestContext.Create(scenario.TenantId, out _, scenario.DbName))
        {
            var assignment = await db.EvaluationAssignments
                .FirstAsync(a => a.RoundId == scenario.RoundId
                                 && a.Kind == EvaluationAssignmentKind.ManagerAssessment);
            assignment.ForceStatus(EvaluationAssignmentStatus.Submitted);
            await db.SaveChangesAsync();
        }

        Assert.False(await IsEligibleAsync(scenario));
    }

    [Fact]
    public async Task An_excluded_participant_does_not_block_closure()
    {
        var scenario = await SeedAsync(EvaluationAssignmentStatus.Finalized);

        await using (var db = PerformanceTestContext.Create(scenario.TenantId, out var tenant, scenario.DbName))
        {
            var assignment = await db.EvaluationAssignments
                .FirstAsync(a => a.RoundId == scenario.RoundId
                                 && a.Kind == EvaluationAssignmentKind.ManagerAssessment);
            assignment.ForceStatus(EvaluationAssignmentStatus.NotStarted);

            var round = await db.EvaluationRounds
                .Include(r => r.Participants)
                .SingleAsync(r => r.Id == scenario.RoundId);
            var campaignParticipant = await db.PerformanceCycleParticipants
                .SingleAsync(p => p.CycleId == scenario.CampaignId
                                  && p.EmployeeId == assignment.ParticipantEmployeeId);

            db.EvaluationRoundExclusions.Add(BuildExclusion(
                tenant.TenantId, scenario.RoundId, campaignParticipant.EmployeeId, campaignParticipant.FullName));
            await db.SaveChangesAsync();
        }

        // Their recorded work is preserved, but they must not hold the cycle open.
        Assert.True(await IsEligibleAsync(scenario));
    }

    /// <summary>
    /// Builds an exclusion directly: the domain factory is internal to the round aggregate, and the
    /// round-level exclusion surface is wired in a later task.
    /// </summary>
    private static Performance.Domain.Entities.EvaluationRoundExclusion BuildExclusion(
        Guid tenantId, Guid roundId, Guid participantEmployeeId, string participantName)
    {
        var factory = typeof(Performance.Domain.Entities.EvaluationRoundExclusion)
            .GetMethod("Create", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)
            ?? typeof(Performance.Domain.Entities.EvaluationRoundExclusion)
                .GetMethod("Create", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);

        return (Performance.Domain.Entities.EvaluationRoundExclusion)factory!.Invoke(
            null, [tenantId, roundId, participantEmployeeId, participantName, "Left the company"])!;
    }

    [Fact]
    public async Task A_campaign_with_no_launched_round_never_closes_by_itself()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"closure-noround-{Guid.NewGuid()}";

        Guid campaignId;
        await using (var db = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            // Seeded but never launched: the round stays Draft.
            var seeded = await EvaluationTestScenario.SeedAsync(db, tenantId);
            campaignId = seeded.CampaignId;
        }

        await using var read = PerformanceTestContext.Create(tenantId, out _, dbName);

        // "All the work is done" would be vacuously true with no launched round, which would close
        // campaigns that never started. Those close manually instead.
        Assert.False(await new CampaignClosureEligibilityResolver(read)
            .IsEligibleForAutomaticClosureAsync(campaignId, CancellationToken.None));
    }

    [Fact]
    public async Task An_unacknowledged_evaluation_does_not_block_closure()
    {
        var scenario = await SeedAsync(EvaluationAssignmentStatus.Finalized);

        // Nothing was acknowledged, and the campaign is still eligible: acknowledgement is
        // employee-initiated and unbounded, so gating on it would let one person hold a cycle open.
        Assert.True(await IsEligibleAsync(scenario));
    }

    [Fact]
    public async Task An_already_closed_campaign_is_not_eligible_again()
    {
        var scenario = await SeedAsync(EvaluationAssignmentStatus.Finalized);
        await CloseAsync(scenario, CampaignClosureKind.Automatic);

        Assert.False(await IsEligibleAsync(scenario));
    }

    [Fact]
    public async Task Closing_a_campaign_cascades_to_its_open_rounds()
    {
        var scenario = await SeedAsync(EvaluationAssignmentStatus.Finalized);
        await CloseAsync(scenario, CampaignClosureKind.Automatic);

        await using var read = PerformanceTestContext.Create(scenario.TenantId, out _, scenario.DbName);
        var round = await read.EvaluationRounds.SingleAsync(r => r.Id == scenario.RoundId);

        Assert.Equal(EvaluationRoundStatus.Closed, round.Status);
        Assert.NotNull(round.ClosedAt);
    }

    [Fact]
    public async Task Closure_records_an_audit_event_for_the_campaign_and_each_round()
    {
        var scenario = await SeedAsync(EvaluationAssignmentStatus.Finalized);
        await CloseAsync(scenario, CampaignClosureKind.Manual);

        await using var read = PerformanceTestContext.Create(scenario.TenantId, out _, scenario.DbName);
        var actions = await read.PerformanceCycleAuditEvents
            .Where(item => item.CycleId == scenario.CampaignId)
            .Select(item => item.Action)
            .ToListAsync();

        Assert.Contains(PerformanceCycleAuditAction.CampaignClosed, actions);
        Assert.Contains(PerformanceCycleAuditAction.EvaluationRoundClosed, actions);
    }

    [Fact]
    public async Task The_outstanding_work_report_counts_what_closing_now_would_leave_unfinished()
    {
        var scenario = await SeedAsync(EvaluationAssignmentStatus.Finalized);

        await using (var db = PerformanceTestContext.Create(scenario.TenantId, out _, scenario.DbName))
        {
            var assignment = await db.EvaluationAssignments
                .FirstAsync(a => a.RoundId == scenario.RoundId
                                 && a.Kind == EvaluationAssignmentKind.ManagerAssessment);
            assignment.ForceStatus(EvaluationAssignmentStatus.InProgress);
            await db.SaveChangesAsync();
        }

        await using var read = PerformanceTestContext.Create(scenario.TenantId, out _, scenario.DbName);
        var outstanding = await new CampaignClosureEligibilityResolver(read)
            .ResolveOutstandingWorkAsync(scenario.CampaignId, CancellationToken.None);

        Assert.Equal(1, outstanding.UnfinalizedManagerAssessments);
        Assert.True(outstanding.HasOutstandingWork);
    }

    [Fact]
    public async Task A_finished_campaign_reports_nothing_outstanding()
    {
        var scenario = await SeedAsync(EvaluationAssignmentStatus.Finalized);

        await using (var db = PerformanceTestContext.Create(scenario.TenantId, out _, scenario.DbName))
        {
            // Self assessments come out of the scenario unsubmitted; submit them so the only
            // remaining question is the manager side.
            foreach (var assignment in await db.EvaluationAssignments
                         .Where(a => a.RoundId == scenario.RoundId
                                     && a.Kind == EvaluationAssignmentKind.SelfAssessment)
                         .ToListAsync())
            {
                assignment.ForceStatus(EvaluationAssignmentStatus.Submitted);
            }

            await db.SaveChangesAsync();
        }

        await using var read = PerformanceTestContext.Create(scenario.TenantId, out _, scenario.DbName);
        var outstanding = await new CampaignClosureEligibilityResolver(read)
            .ResolveOutstandingWorkAsync(scenario.CampaignId, CancellationToken.None);

        Assert.Equal(0, outstanding.UnfinalizedManagerAssessments);
        Assert.Equal(0, outstanding.UnsubmittedSelfAssessments);
    }

    [Fact]
    public async Task Sweeps_scope_to_open_campaigns_so_closed_history_is_not_re_swept()
    {
        var scenario = await SeedAsync(EvaluationAssignmentStatus.Finalized);
        await CloseAsync(scenario, CampaignClosureKind.Automatic);

        await using var read = PerformanceTestContext.Create(scenario.TenantId, out _, scenario.DbName);

        // Per-tick swept volume is bounded by open campaigns, not by everything the tenant ever ran.
        Assert.Empty(await read.PerformanceCycles.OpenOnly()
            .Where(campaign => campaign.Id == scenario.CampaignId)
            .ToListAsync());
    }

    [Fact]
    public async Task A_closed_campaign_leaves_the_active_campaign_doors()
    {
        var scenario = await SeedAsync(EvaluationAssignmentStatus.Finalized);
        await CloseAsync(scenario, CampaignClosureKind.Automatic);

        await using var read = PerformanceTestContext.Create(scenario.TenantId, out _, scenario.DbName);

        // Every campaign-scoped door filters on Launched, which Closed is not — so closure removes a
        // campaign from the active workspace lists without each door needing its own rule.
        Assert.Empty(await read.PerformanceCycles
            .Where(campaign => campaign.Status == PerformanceCycleStatus.Launched)
            .Where(campaign => campaign.Id == scenario.CampaignId)
            .ToListAsync());
    }
}
