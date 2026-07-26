using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Evaluations;

/// <summary>
/// Task 4.3 — backward compatibility regression. A launched round created before the
/// skills/execution extension (objective-only, no expectation set) must load through the
/// post-migration model with the new nullable columns absent: no skill snapshot, weights
/// defaulting to 100/0, <c>IncludesSkills == false</c>, and every generated assignment
/// carrying a null <c>SkillSnapshotId</c>.
/// </summary>
public class EvaluationExecutionBackwardCompatTests
{
    [Fact]
    public async Task PreChangeShapedLaunchedRound_LoadsWithSkillsAbsentAndDefaultWeights()
    {
        var tenantId = Guid.NewGuid();
        var databaseName = $"backcompat-{Guid.NewGuid()}";

        Guid roundId;
        await using (var seedDb = PerformanceTestContext.Create(tenantId, out _, databaseName))
        {
            var result = await EvaluationTestScenario.SeedAndLaunchFreshAsync(seedDb, tenantId);
            roundId = result.RoundId;
        }

        // Reload through a fresh context to exercise the EF read path for the new columns.
        await using var readDb = PerformanceTestContext.Create(tenantId, out _, databaseName);
        var round = await readDb.EvaluationRounds
            .Include(r => r.SkillSnapshot)
            .Include(r => r.PolicySnapshot)
            .AsNoTracking()
            .SingleAsync(r => r.Id == roundId);

        Assert.False(round.IncludesSkills);
        Assert.Null(round.SkillSnapshot);
        Assert.Null(round.SourceExpectationSetId);
        Assert.Equal(100, round.ObjectivesWeightPercent);
        Assert.Equal(0, round.SkillsWeightPercent);
        Assert.Equal(100, round.PolicySnapshot!.ObjectivesWeightPercent);
        Assert.Equal(0, round.PolicySnapshot.SkillsWeightPercent);

        var assignments = await readDb.EvaluationAssignments
            .AsNoTracking()
            .Where(a => a.RoundId == roundId)
            .ToListAsync();

        Assert.NotEmpty(assignments);
        Assert.All(assignments, a => Assert.Null(a.SkillSnapshotId));
    }
}
