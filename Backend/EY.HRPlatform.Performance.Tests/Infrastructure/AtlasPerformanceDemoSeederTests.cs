using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace EY.HRPlatform.Performance.Tests.Infrastructure;

public sealed class AtlasPerformanceDemoSeederTests
{
    [Fact]
    public async Task SeedAsync_CreatesCompleteMixedStateScenario_AndIsIdempotent()
    {
        var tenantId = Guid.NewGuid();
        var tenant = new TenantContext();
        tenant.SetTenant(tenantId);
        var options = new DbContextOptionsBuilder<PerformanceDbContext>()
            .UseInMemoryDatabase($"atlas-progress-seed-{Guid.NewGuid():N}")
            .Options;
        await using var db = new PerformanceDbContext(options, tenant);
        var asOf = new DateTime(2026, 7, 20, 12, 0, 0, DateTimeKind.Utc);

        await AtlasPerformanceDemoSeeder.SeedAsync(db, tenantId, asOf);
        await AtlasPerformanceDemoSeeder.SeedAsync(db, tenantId, asOf);

        var cycle = await db.PerformanceCycles
            .Include(item => item.Participants)
            .SingleAsync(item => item.Slug == AtlasPerformanceDemoSeeder.CycleSlug);
        var plan = await db.EmployeeObjectivePlans
            .Include(item => item.Objectives)
            .Include(item => item.ReviewEvents)
            .SingleAsync(item => item.CycleId == cycle.Id);
        var updates = await db.ObjectiveProgressUpdates
            .Where(item => item.PlanId == plan.Id)
            .OrderBy(item => item.RecordedAt)
            .ToListAsync();

        Assert.True(cycle.IsPlanningLocked);
        Assert.Single(cycle.Participants);
        Assert.Equal(PlanStatus.Approved, plan.Status);
        Assert.Equal(4, plan.Objectives.Count);
        Assert.Contains(plan.ReviewEvents, item => item.Type == ReviewEventType.Approved);
        Assert.Equal(4, updates.Count);
        Assert.Contains(updates, item => item.ProgressPercent == 100);
        Assert.Contains(updates, item => item.ProgressPercent == 50 && item.IsRegression);
        Assert.Contains(updates, item => item.ProgressPercent == 25);
        Assert.Equal(3, updates.Select(item => item.ObjectiveId).Distinct().Count());

        // End-to-end check-in walkthrough: a completed check-in on the setback objective, with a
        // resolved discussion signal, one completed employee action, one open reviewer action, and
        // the employee's single response.
        var checkIn = await db.PerformanceCheckIns
            .Include(item => item.LinkedObjectives)
            .SingleAsync(item => item.CycleId == cycle.Id);
        Assert.Equal(CheckInStatus.Completed, checkIn.Status);
        Assert.NotNull(checkIn.CompletionSummary);
        Assert.NotNull(checkIn.Response);
        Assert.Contains(checkIn.LinkedObjectives, item => item.WasDiscussed);

        var signal = await db.ObjectiveDiscussionSignals.SingleAsync(item => item.CycleId == cycle.Id);
        Assert.Equal(DiscussionSignalStatus.ResolvedByCheckIn, signal.Status);
        Assert.Equal(checkIn.Id, signal.ResolvedByCheckInId);

        var actions = await db.CheckInFollowUpActions
            .Where(item => item.CheckInId == checkIn.Id)
            .ToListAsync();
        Assert.Equal(2, actions.Count);
        Assert.Contains(actions, item => item.OwnerKind == FollowUpActionOwnerKind.Employee
            && item.Status == FollowUpActionStatus.Completed);
        Assert.Contains(actions, item => item.OwnerKind == FollowUpActionOwnerKind.Reviewer
            && item.Status == FollowUpActionStatus.Open);

        var scale = await db.EvaluationRatingScales
            .Include(item => item.Levels)
            .SingleAsync(item => item.Name == "Five-level performance scale");
        Assert.Equal(EvaluationConfigStatus.Active, scale.Status);
        Assert.Equal(5, scale.Levels.Count);

        var template = await db.EvaluationTemplates
            .Include(item => item.Sections)
            .SingleAsync(item => item.Name == "Starter annual evaluation");
        Assert.Equal(EvaluationConfigStatus.Active, template.Status);
        Assert.Equal(
            [EvaluationSectionType.Objectives, EvaluationSectionType.CustomQuestions, EvaluationSectionType.OverallComments],
            template.Sections.OrderBy(item => item.Ordinal).Select(item => item.Type));

        var round = await db.EvaluationRounds
            .Include(item => item.Participants)
            .SingleAsync(item => item.Name == AtlasPerformanceDemoSeeder.EvaluationRoundName);
        Assert.Equal(EvaluationRoundStatus.Launched, round.Status);
        Assert.Equal(EvaluationAssessmentModel.SelfAndManager, round.AssessmentModel);
        Assert.Single(round.Participants);
        var assignments = await db.EvaluationAssignments
            .Where(item => item.RoundId == round.Id)
            .ToListAsync();
        Assert.Equal(2, assignments.Count);
        Assert.Contains(assignments, item => item.Kind == EvaluationAssignmentKind.SelfAssessment);
        Assert.Contains(assignments, item => item.Kind == EvaluationAssignmentKind.ManagerAssessment);

        var executionRound = await db.EvaluationRounds
            .Include(item => item.Participants)
            .SingleAsync(item => item.Name == AtlasPerformanceDemoSeeder.AssessmentRoundName);
        Assert.Equal(6, executionRound.Participants.Count);
        var executionAssignments = await db.EvaluationAssignments
            .Where(item => item.RoundId == executionRound.Id)
            .ToListAsync();
        Assert.Equal(12, executionAssignments.Count);
        Assert.Contains(executionAssignments, item => item.Status == EvaluationAssignmentStatus.NotStarted);
        Assert.Contains(executionAssignments, item => item.Status == EvaluationAssignmentStatus.InProgress);
        Assert.Contains(executionAssignments, item => item.Kind == EvaluationAssignmentKind.SelfAssessment
            && item.Status == EvaluationAssignmentStatus.Submitted);
        Assert.Contains(executionAssignments, item => item.Kind == EvaluationAssignmentKind.ManagerAssessment
            && item.Status == EvaluationAssignmentStatus.Submitted);
        Assert.Contains(executionAssignments, item => item.Status == EvaluationAssignmentStatus.Finalized
            && item.AcknowledgedAt is null);
        Assert.Contains(executionAssignments, item => item.AcknowledgedAt is not null);

        var executionRoundCount = await db.EvaluationRounds.CountAsync(item => item.Name == AtlasPerformanceDemoSeeder.AssessmentRoundName);
        Assert.Equal(1, executionRoundCount);
    }

    [Fact]
    public async Task SeedIsolationTenantAsync_CreatesContrastingManagerOnlyScenario_AndIsIdempotent()
    {
        var tenantAId = Guid.NewGuid();
        var tenantBId = Guid.NewGuid();
        var databaseRoot = new InMemoryDatabaseRoot();
        var databaseName = $"atlas-evaluation-isolation-{Guid.NewGuid():N}";
        var asOf = new DateTime(2026, 7, 20, 12, 0, 0, DateTimeKind.Utc);

        var tenantA = new TenantContext();
        tenantA.SetTenant(tenantAId);
        var tenantAOptions = new DbContextOptionsBuilder<PerformanceDbContext>()
            .UseInMemoryDatabase(databaseName, databaseRoot)
            .Options;
        await using (var db = new PerformanceDbContext(tenantAOptions, tenantA))
            await AtlasPerformanceDemoSeeder.SeedAsync(db, tenantAId, asOf);

        var tenantB = new TenantContext();
        tenantB.SetTenant(tenantBId);
        var tenantBOptions = new DbContextOptionsBuilder<PerformanceDbContext>()
            .UseInMemoryDatabase(databaseName, databaseRoot)
            .Options;
        await using var isolationDb = new PerformanceDbContext(tenantBOptions, tenantB);
        await AtlasPerformanceDemoSeeder.SeedIsolationTenantAsync(isolationDb, tenantBId, asOf);
        await AtlasPerformanceDemoSeeder.SeedIsolationTenantAsync(isolationDb, tenantBId, asOf);

        var scale = await isolationDb.EvaluationRatingScales
            .Include(item => item.Levels)
            .SingleAsync();
        Assert.Equal(tenantBId, scale.TenantId);
        Assert.Equal(4, scale.Levels.Count);

        var round = await isolationDb.EvaluationRounds.SingleAsync();
        Assert.Equal(EvaluationRoundStatus.Launched, round.Status);
        Assert.Equal(EvaluationAssessmentModel.ManagerOnly, round.AssessmentModel);
        Assert.Null(round.SelfAssessmentDeadline);

        var assignments = await isolationDb.EvaluationAssignments.ToListAsync();
        Assert.Single(assignments);
        Assert.Equal(EvaluationAssignmentKind.ManagerAssessment, assignments[0].Kind);
        Assert.Equal(EvaluationAssignmentStatus.Finalized, assignments[0].Status);
        Assert.Equal(3, assignments[0].FinalRatingOrdinal);

        var plan = await isolationDb.EmployeeObjectivePlans
            .Include(item => item.Objectives)
            .SingleAsync();
        Assert.Single(plan.Objectives);
        Assert.Equal(100, plan.Objectives.Single().Weight);
    }
}
