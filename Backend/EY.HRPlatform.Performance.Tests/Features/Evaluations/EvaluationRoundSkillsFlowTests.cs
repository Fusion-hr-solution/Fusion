using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Commands;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Queries;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Services;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Evaluations;

/// <summary>Task 6.4: skills round draft → readiness → launch flow, blockers, and no-skills regression.</summary>
public class EvaluationRoundSkillsFlowTests
{
    private static readonly IPerformanceAccessPolicyService Access = new PerformanceAccessPolicyService();

    private static System.Security.Claims.ClaimsPrincipal Manager() => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid())
        .WithPermission(PerformancePermissions.EvaluationManage, PermissionScopes.Tenant)
        .Build();

    private static async Task<EY.HRPlatform.Performance.Features.Evaluations.Rounds.Dtos.EvaluationRoundReadinessDto>
        ReadinessAsync(PerformanceDbContext db, Guid roundId)
    {
        var resolver = new EvaluationRoundReadinessResolver(db, new EffectiveReviewerResolver(db));
        var handler = new GetEvaluationRoundReadinessQueryHandler(db, Access, resolver);
        var result = await handler.Handle(new GetEvaluationRoundReadinessQuery(Manager(), roundId), CancellationToken.None);
        Assert.True(result.IsSuccess);
        return result.Value;
    }

    [Fact]
    public async Task SkillsRound_FullyConfigured_IsReadyToLaunch()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"skills-ready-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAsync(db, tenantId, new(IncludeSkillsSection: true));

        var readiness = await ReadinessAsync(db, scenario.RoundId);

        Assert.True(readiness.CanLaunch);
        Assert.DoesNotContain(readiness.Blockers, x => x.Code.StartsWith("Round.Skill"));
        Assert.True(readiness.Skills.IncludesSkills);
        Assert.True(readiness.Skills.SetSelected);
        Assert.Equal(2, readiness.Skills.ItemCount);
        Assert.Equal(70, readiness.Skills.ObjectivesWeightPercent);
        Assert.Equal(30, readiness.Skills.SkillsWeightPercent);
    }

    [Fact]
    public async Task SkillsSectionWithoutSelectedSet_BlocksLaunch()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"skills-noset-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAsync(
            db, tenantId, new(IncludeSkillsSection: true, SelectExpectationSet: false));

        var readiness = await ReadinessAsync(db, scenario.RoundId);

        Assert.False(readiness.CanLaunch);
        Assert.Contains(readiness.Blockers, x => x.Code == "Round.SkillSetMissing");
    }

    [Fact]
    public async Task SkillsSectionWithZeroSkillsWeight_BlocksLaunch()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"skills-zeroweight-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAsync(
            db, tenantId, new(IncludeSkillsSection: true, SkillsWeightPercent: 0));

        var readiness = await ReadinessAsync(db, scenario.RoundId);

        Assert.False(readiness.CanLaunch);
        Assert.Contains(readiness.Blockers, x => x.Code == "Round.SkillsWeightUnset");
    }

    [Fact]
    public async Task LaunchWithSkills_CapturesSnapshot_MarksInUse_AndAssignmentsReferenceIt()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"skills-launch-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAndLaunchFreshAsync(db, tenantId, new(IncludeSkillsSection: true));

        var round = await db.EvaluationRounds.AsNoTracking()
            .Include(r => r.SkillSnapshot).ThenInclude(s => s!.Items)
            .Include(r => r.SkillSnapshot).ThenInclude(s => s!.Levels)
            .SingleAsync(r => r.Id == scenario.RoundId);
        Assert.NotNull(round.SkillSnapshot);
        Assert.Equal("Core capabilities", round.SkillSnapshot!.SetName);
        Assert.Equal(2, round.SkillSnapshot.Items.Count);
        Assert.Equal(5, round.SkillSnapshot.Levels.Count);
        Assert.Equal(30, round.SkillsWeightPercent);

        var assignments = await db.EvaluationAssignments.AsNoTracking()
            .Where(a => a.RoundId == scenario.RoundId).ToListAsync();
        Assert.NotEmpty(assignments);
        Assert.All(assignments, a => Assert.Equal(round.SkillSnapshot.Id, a.SkillSnapshotId));

        var set = await db.SkillExpectationSets.AsNoTracking().SingleAsync(s => s.Id == scenario.ExpectationSetId);
        var scale = await db.ProficiencyScales.AsNoTracking().SingleAsync(s => s.Id == scenario.ProficiencyScaleId);
        Assert.True(set.IsInUse);
        Assert.True(scale.IsInUse);
        var skills = await db.Skills.AsNoTracking().Where(s => scenario.SkillIds!.Contains(s.Id)).ToListAsync();
        Assert.All(skills, s => Assert.True(s.IsInUse));
    }

    [Fact]
    public async Task ManagerOnlyRoundWithoutSkills_LaunchesWithNullSkillSnapshot()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"skills-regression-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAndLaunchFreshAsync(
            db, tenantId, new(AssessmentModel: EvaluationAssessmentModel.ManagerOnly));

        var round = await db.EvaluationRounds.AsNoTracking()
            .Include(r => r.SkillSnapshot)
            .SingleAsync(r => r.Id == scenario.RoundId);
        Assert.Null(round.SkillSnapshot);
        Assert.Equal(100, round.ObjectivesWeightPercent);
        Assert.Equal(0, round.SkillsWeightPercent);

        var assignments = await db.EvaluationAssignments.AsNoTracking()
            .Where(a => a.RoundId == scenario.RoundId).ToListAsync();
        Assert.NotEmpty(assignments);
        Assert.All(assignments, a => Assert.Null(a.SkillSnapshotId));
    }

    [Fact]
    public async Task SetWeightsHandler_WithNonHundredSum_IsRejected()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"skills-weight-invalid-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAsync(db, tenantId, new(IncludeSkillsSection: true));
        var version = await db.EvaluationRounds.AsNoTracking().Where(r => r.Id == scenario.RoundId).Select(r => r.Version).SingleAsync();

        var handler = new SetEvaluationRoundWeightsCommandHandler(db, Access);
        var result = await handler.Handle(
            new SetEvaluationRoundWeightsCommand(Manager(), scenario.RoundId, 60, 30, version), CancellationToken.None);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task SetWeightsHandler_WithValidSplit_Persists()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"skills-weight-valid-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAsync(db, tenantId, new(IncludeSkillsSection: true));
        var version = await db.EvaluationRounds.AsNoTracking().Where(r => r.Id == scenario.RoundId).Select(r => r.Version).SingleAsync();

        var handler = new SetEvaluationRoundWeightsCommandHandler(db, Access);
        var result = await handler.Handle(
            new SetEvaluationRoundWeightsCommand(Manager(), scenario.RoundId, 60, 40, version), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(60, result.Value.Skills.ObjectivesWeightPercent);
        Assert.Equal(40, result.Value.Skills.SkillsWeightPercent);
    }
}
