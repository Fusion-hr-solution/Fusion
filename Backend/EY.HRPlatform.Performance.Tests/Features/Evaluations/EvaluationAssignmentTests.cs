using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Queries;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Services;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Evaluations;

/// <summary>
/// Task 14.2: assignment generation counts, eligibility/omission, effective-reviewer resolution,
/// and generation idempotency. Generation is exercised through the seeder-style fresh-insert launch
/// (the same domain path the handler runs); effective-reviewer resolution is asserted through the
/// readiness resolver's assignment preview, which computes the exact reviewer the launch assigns.
/// </summary>
public class EvaluationAssignmentTests
{
    private static readonly IPerformanceAccessPolicyService Access = new PerformanceAccessPolicyService();

    private static System.Security.Claims.ClaimsPrincipal Manager() => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid())
        .WithPermission(PerformancePermissions.EvaluationManage, PermissionScopes.Tenant)
        .Build();

    [Fact]
    public async Task SelfAndManager_GeneratesSelfAndManagerAssignmentsPerEligibleParticipant()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"assign-self-and-manager-{Guid.NewGuid()}";
        EvaluationTestScenario.Result scenario;
        int eligible;

        await using (var db = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            scenario = await EvaluationTestScenario.SeedAndLaunchFreshAsync(db, tenantId, new(AssessmentModel: EvaluationAssessmentModel.SelfAndManager));
            eligible = scenario.Participants.Count(p => p.HasApprovedPlan); // 2
        }

        await using var verify = PerformanceTestContext.Create(tenantId, out _, dbName);
        Assert.Equal(eligible, await verify.EvaluationAssignments.CountAsync(x => x.RoundId == scenario.RoundId && x.Kind == EvaluationAssignmentKind.SelfAssessment));
        Assert.Equal(eligible, await verify.EvaluationAssignments.CountAsync(x => x.RoundId == scenario.RoundId && x.Kind == EvaluationAssignmentKind.ManagerAssessment));
        Assert.All(await verify.EvaluationAssignments.Where(x => x.RoundId == scenario.RoundId).ToListAsync(),
            a => Assert.Equal(scenario.RoundId, a.RoundId));
    }

    [Fact]
    public async Task ManagerOnly_GeneratesManagerAssignmentsWithNoSelfAssessments()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"assign-manager-only-{Guid.NewGuid()}";
        EvaluationTestScenario.Result scenario;
        int eligible;

        await using (var db = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            scenario = await EvaluationTestScenario.SeedAndLaunchFreshAsync(db, tenantId, new(AssessmentModel: EvaluationAssessmentModel.ManagerOnly));
            eligible = scenario.Participants.Count(p => p.HasApprovedPlan);
        }

        await using var verify = PerformanceTestContext.Create(tenantId, out _, dbName);
        Assert.Equal(eligible, await verify.EvaluationAssignments.CountAsync(x => x.RoundId == scenario.RoundId && x.Kind == EvaluationAssignmentKind.ManagerAssessment));
        Assert.Equal(0, await verify.EvaluationAssignments.CountAsync(x => x.RoundId == scenario.RoundId && x.Kind == EvaluationAssignmentKind.SelfAssessment));
    }

    [Fact]
    public async Task ParticipantWithoutApprovedPlan_IsOmittedFromGeneration()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"assign-omission-{Guid.NewGuid()}";
        EvaluationTestScenario.Result scenario;

        await using (var db = PerformanceTestContext.Create(tenantId, out _, dbName))
            scenario = await EvaluationTestScenario.SeedAndLaunchFreshAsync(
                db, tenantId, new(AssessmentModel: EvaluationAssessmentModel.ManagerOnly, IncludeParticipantMissingPlan: true));

        var missing = scenario.Participants.Single(p => !p.HasApprovedPlan);
        await using var verify = PerformanceTestContext.Create(tenantId, out _, dbName);
        Assert.False(await verify.EvaluationAssignments.AnyAsync(x => x.RoundId == scenario.RoundId && x.ParticipantEmployeeId == missing.EmployeeId));
        Assert.Equal(
            scenario.Participants.Count(p => p.HasApprovedPlan),
            await verify.EvaluationAssignments.CountAsync(x => x.RoundId == scenario.RoundId && x.Kind == EvaluationAssignmentKind.ManagerAssessment));
    }

    [Fact]
    public async Task Generation_YieldsExactlyOneAssignmentPerParticipantAndKind()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"assign-uniqueness-{Guid.NewGuid()}";
        EvaluationTestScenario.Result scenario;

        await using (var db = PerformanceTestContext.Create(tenantId, out _, dbName))
            scenario = await EvaluationTestScenario.SeedAndLaunchFreshAsync(db, tenantId, new(AssessmentModel: EvaluationAssessmentModel.SelfAndManager));

        await using var verify = PerformanceTestContext.Create(tenantId, out _, dbName);
        var assignments = await verify.EvaluationAssignments.Where(x => x.RoundId == scenario.RoundId).ToListAsync();
        // Domain-level uniqueness: at most one assignment per (round, participant, kind).
        // NOTE: the DB unique index and xmin optimistic concurrency that enforce this at the
        // Postgres runtime are not exercised by EF InMemory; this asserts the domain guarantee,
        // and the constraint itself is covered structurally by the migration.
        var duplicates = assignments
            .GroupBy(a => new { a.RoundId, a.ParticipantEmployeeId, a.Kind })
            .Where(g => g.Count() > 1);
        Assert.Empty(duplicates);
    }

    [Fact]
    public async Task EffectiveReviewer_HonorsLatestApproverReassignment()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"assign-reassignment-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAsync(db, tenantId, new(AssessmentModel: EvaluationAssessmentModel.ManagerOnly));

        var target = scenario.Participants.First(p => p.HasApprovedPlan);
        var newReviewer = Guid.NewGuid();
        db.PerformanceCycleApproverReassignments.Add(PerformanceCycleApproverReassignment.Create(
            tenantId, scenario.CampaignId, target.EmployeeId, target.ReviewerId, target.ReviewerName,
            newReviewer, "New Reviewer", "Reorg", Guid.NewGuid(), "HR", DateTime.UtcNow));
        await db.SaveChangesAsync();

        // The readiness assignment preview computes the exact reviewer the launch assigns.
        var resolver = new EvaluationRoundReadinessResolver(db, new EffectiveReviewerResolver(db));
        var handler = new GetEvaluationRoundReadinessQueryHandler(db, Access, resolver);
        var readiness = (await handler.Handle(new GetEvaluationRoundReadinessQuery(Manager(), scenario.RoundId), CancellationToken.None)).Value;

        var preview = readiness.AssignmentPreview.Single(x => x.EmployeeId == target.EmployeeId);
        Assert.Equal(newReviewer, preview.ReviewerEmployeeId);
    }
}
