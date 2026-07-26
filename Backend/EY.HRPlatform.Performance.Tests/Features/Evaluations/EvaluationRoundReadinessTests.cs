using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Queries;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Services;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Performance.Tests.Features.Evaluations;

/// <summary>
/// Task 14.1 (readiness) plus Workstream B: exercises the readiness resolver's blockers and
/// warnings — including the new TemplateNoAssessableSection blocker and the ShortDeadline /
/// NoContextualQuestions warnings — through the query handler.
/// </summary>
public class EvaluationRoundReadinessTests
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
    public async Task ReadyRound_HasNoBlockersOrWarnings_AndCanLaunch()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"readiness-ready-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAsync(db, tenantId);

        var readiness = await ReadinessAsync(db, scenario.RoundId);

        Assert.True(readiness.CanLaunch);
        Assert.Empty(readiness.Blockers);
        Assert.Empty(readiness.Warnings);
    }

    [Fact]
    public async Task PlanningUnlocked_IsABlocker()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"readiness-unlocked-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAsync(db, tenantId, new(LockPlanning: false));

        var readiness = await ReadinessAsync(db, scenario.RoundId);

        Assert.False(readiness.CanLaunch);
        Assert.Contains(readiness.Blockers, x => x.Code == "Campaign.PlanningUnlocked");
    }

    [Fact]
    public async Task TemplateWithOnlyOverallComments_IsBlockedByTemplateNoAssessableSection()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"readiness-no-assessable-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAsync(db, tenantId, new(AssessableTemplate: false));

        var readiness = await ReadinessAsync(db, scenario.RoundId);

        Assert.False(readiness.CanLaunch);
        Assert.Contains(readiness.Blockers, x => x.Code == "Round.TemplateNoAssessableSection");
    }

    [Fact]
    public async Task SelfReviewParticipant_IsABlocker()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"readiness-self-review-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAsync(db, tenantId, new(IncludeSelfReviewParticipant: true));

        var readiness = await ReadinessAsync(db, scenario.RoundId);

        Assert.False(readiness.CanLaunch);
        Assert.Contains(readiness.Blockers, x => x.Code == "Round.SelfReview");
    }

    [Fact]
    public async Task ParticipantMissingApprovedPlan_ProducesObjectivePlanOmittedWarning_ButStaysLaunchable()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"readiness-omitted-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAsync(db, tenantId, new(IncludeParticipantMissingPlan: true));

        var readiness = await ReadinessAsync(db, scenario.RoundId);

        Assert.Contains(readiness.Warnings, x => x.Code == "Round.ObjectivePlanOmitted");
        Assert.True(readiness.CanLaunch); // eligible participants remain, so the round is still launchable
    }

    [Fact]
    public async Task ShortManagerDeadline_ProducesShortDeadlineWarning_ButStaysLaunchable()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"readiness-short-deadline-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAsync(
            db, tenantId, new(AssessmentModel: EvaluationAssessmentModel.ManagerOnly, ManagerDeadline: DateTime.UtcNow.AddDays(3)));

        var readiness = await ReadinessAsync(db, scenario.RoundId);

        Assert.Contains(readiness.Warnings, x => x.Code == "Round.ShortDeadline");
        Assert.True(readiness.CanLaunch);
    }

    [Fact]
    public async Task TemplateWithoutContextualQuestions_ProducesNoContextualQuestionsWarning()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"readiness-no-questions-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAsync(db, tenantId, new(IncludeCustomQuestions: false));

        var readiness = await ReadinessAsync(db, scenario.RoundId);

        Assert.Contains(readiness.Warnings, x => x.Code == "Round.NoContextualQuestions");
        Assert.True(readiness.CanLaunch);
    }
}
