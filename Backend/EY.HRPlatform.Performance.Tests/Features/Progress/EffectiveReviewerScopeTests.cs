using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Progress;

/// <summary>
/// Reviewer-scoped reads must cost the caller's scope, not the tenant's (design D12), while the
/// effective-reviewer rule stays identical to the campaign-wide path.
/// </summary>
public sealed class EffectiveReviewerScopeTests
{
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private sealed record Seeded(Guid TenantId, string DbName, Guid CycleId, Guid ReviewerId, List<Guid> ReviewedEmployeeIds);

    /// <summary>Seeds one campaign where a single reviewer approves a handful of a large population.</summary>
    private static async Task<Seeded> SeedLargeCampaignAsync(int population, int reviewedCount)
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"reviewer-scope-{Guid.NewGuid()}";
        var reviewerId = Guid.NewGuid();
        var reviewed = new List<Guid>();

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);

        var cycle = TestCycles.Create(
            tenantId, "FY26", PerformanceCycleType.Annual,
            Start, Start.AddYears(1), objectiveSettingDeadline: Start.AddDays(30)).ForceLaunched();
        db.PerformanceCycles.Add(cycle);

        for (var i = 0; i < population; i++)
        {
            var employeeId = Guid.NewGuid();
            var isReviewed = i < reviewedCount;
            if (isReviewed)
            {
                reviewed.Add(employeeId);
            }

            db.PerformanceCycleParticipants.Add(PerformanceCycleParticipant.Create(
                tenantId, cycle.Id, employeeId, $"Employee {i}",
                isReviewed ? reviewerId : Guid.NewGuid(),
                isReviewed ? "The Reviewer" : $"Other Manager {i}"));
        }

        await db.SaveChangesAsync();
        return new Seeded(tenantId, dbName, cycle.Id, reviewerId, reviewed);
    }

    [Fact]
    public async Task A_reviewer_of_eight_of_twelve_hundred_reads_only_their_eight()
    {
        var seeded = await SeedLargeCampaignAsync(population: 1200, reviewedCount: 8);

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var resolved = await new EffectiveReviewerResolver(db)
            .ResolveParticipantsForReviewerAsync(seeded.CycleId, seeded.ReviewerId, CancellationToken.None);

        Assert.Equal(8, resolved.Count);
        Assert.Equal(seeded.ReviewedEmployeeIds.OrderBy(id => id), resolved.OrderBy(id => id));
    }

    [Fact]
    public async Task A_reassignment_overrides_the_frozen_baseline_in_the_scoped_read()
    {
        var seeded = await SeedLargeCampaignAsync(population: 20, reviewedCount: 3);
        var movedEmployeeId = seeded.ReviewedEmployeeIds[0];
        var newReviewerId = Guid.NewGuid();

        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName))
        {
            db.PerformanceCycleApproverReassignments.Add(PerformanceCycleApproverReassignment.Create(
                seeded.TenantId, seeded.CycleId, movedEmployeeId,
                seeded.ReviewerId, "The Reviewer",
                newReviewerId, "New Reviewer",
                "Reorganisation", Guid.NewGuid(), "HR Admin", Start.AddDays(10)));
            await db.SaveChangesAsync();
        }

        await using var read = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var resolver = new EffectiveReviewerResolver(read);

        var original = await resolver.ResolveParticipantsForReviewerAsync(
            seeded.CycleId, seeded.ReviewerId, CancellationToken.None);
        var replacement = await resolver.ResolveParticipantsForReviewerAsync(
            seeded.CycleId, newReviewerId, CancellationToken.None);

        Assert.DoesNotContain(movedEmployeeId, original);
        Assert.Equal(2, original.Count);
        Assert.Equal([movedEmployeeId], replacement);
    }

    [Fact]
    public async Task The_latest_reassignment_wins_when_a_participant_moves_twice()
    {
        var seeded = await SeedLargeCampaignAsync(population: 5, reviewedCount: 1);
        var movedEmployeeId = seeded.ReviewedEmployeeIds[0];
        var firstReviewerId = Guid.NewGuid();
        var finalReviewerId = Guid.NewGuid();

        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName))
        {
            db.PerformanceCycleApproverReassignments.Add(PerformanceCycleApproverReassignment.Create(
                seeded.TenantId, seeded.CycleId, movedEmployeeId,
                seeded.ReviewerId, "The Reviewer", firstReviewerId, "First Replacement",
                "First move", Guid.NewGuid(), "HR Admin", Start.AddDays(5)));
            db.PerformanceCycleApproverReassignments.Add(PerformanceCycleApproverReassignment.Create(
                seeded.TenantId, seeded.CycleId, movedEmployeeId,
                firstReviewerId, "First Replacement", finalReviewerId, "Final Replacement",
                "Second move", Guid.NewGuid(), "HR Admin", Start.AddDays(9)));
            await db.SaveChangesAsync();
        }

        await using var read = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var resolver = new EffectiveReviewerResolver(read);

        Assert.Empty(await resolver.ResolveParticipantsForReviewerAsync(
            seeded.CycleId, firstReviewerId, CancellationToken.None));
        Assert.Equal([movedEmployeeId], await resolver.ResolveParticipantsForReviewerAsync(
            seeded.CycleId, finalReviewerId, CancellationToken.None));
    }

    [Fact]
    public async Task An_empty_scope_returns_empty_and_never_widens_to_the_population()
    {
        var seeded = await SeedLargeCampaignAsync(population: 500, reviewedCount: 4);

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var resolved = await new EffectiveReviewerResolver(db)
            .ResolveParticipantsForReviewerAsync(seeded.CycleId, Guid.NewGuid(), CancellationToken.None);

        Assert.Empty(resolved);
    }

    [Fact]
    public async Task The_scoped_read_agrees_with_the_campaign_wide_map()
    {
        var seeded = await SeedLargeCampaignAsync(population: 40, reviewedCount: 6);
        var movedEmployeeId = seeded.ReviewedEmployeeIds[0];

        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName))
        {
            db.PerformanceCycleApproverReassignments.Add(PerformanceCycleApproverReassignment.Create(
                seeded.TenantId, seeded.CycleId, movedEmployeeId,
                seeded.ReviewerId, "The Reviewer", Guid.NewGuid(), "Someone Else",
                "Reorganisation", Guid.NewGuid(), "HR Admin", Start.AddDays(4)));
            await db.SaveChangesAsync();
        }

        await using var read = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var resolver = new EffectiveReviewerResolver(read);

        var campaignWide = await resolver.ResolveForCampaignAsync(seeded.CycleId, CancellationToken.None);
        var expected = campaignWide
            .Where(pair => pair.Value == seeded.ReviewerId)
            .Select(pair => pair.Key)
            .OrderBy(id => id)
            .ToList();

        var scoped = (await resolver.ResolveParticipantsForReviewerAsync(
                seeded.CycleId, seeded.ReviewerId, CancellationToken.None))
            .OrderBy(id => id)
            .ToList();

        // One rule, one implementation: the scoped predicate cannot drift from the campaign map.
        Assert.Equal(expected, scoped);
    }

    [Fact]
    public async Task The_bounded_participant_read_resolves_only_the_ids_asked_for()
    {
        var seeded = await SeedLargeCampaignAsync(population: 100, reviewedCount: 5);
        var asked = seeded.ReviewedEmployeeIds.Take(2).ToList();

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var resolved = await new EffectiveReviewerResolver(db)
            .ResolveForParticipantsAsync(seeded.CycleId, asked, CancellationToken.None);

        Assert.Equal(2, resolved.Count);
        Assert.All(resolved, pair => Assert.Equal(seeded.ReviewerId, pair.Value));
        Assert.Equal(asked.OrderBy(id => id), resolved.Keys.OrderBy(id => id));
    }

    [Fact]
    public async Task The_bounded_participant_read_asks_nothing_for_an_empty_set()
    {
        var seeded = await SeedLargeCampaignAsync(population: 10, reviewedCount: 2);

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var resolved = await new EffectiveReviewerResolver(db)
            .ResolveForParticipantsAsync(seeded.CycleId, [], CancellationToken.None);

        Assert.Empty(resolved);
    }
}
