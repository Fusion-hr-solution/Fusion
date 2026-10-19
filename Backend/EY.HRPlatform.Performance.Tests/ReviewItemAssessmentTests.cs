using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Reviews;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Features.Settings;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

public sealed class ReviewItemAssessmentTests
{
    private static readonly DateOnly Start = new(2026, 1, 1);
    private static readonly DateOnly End = new(2026, 12, 31);

    [Fact]
    public async Task Item_ratings_are_required_and_scale_bound_and_objective_progress_stays_live()
    {
        var store = TestStore.ForNewTenant();
        var fixture = await SeedAsync(store, approvedPlan: true);

        await using (var db = store.NewContext())
        {
            var handler = new SubmitSelfAssessmentHandler(db, new TestPerformanceAudit(db), new PerformanceNotifications(db));
            var missing = await handler.Handle(new(fixture.ReviewId, new ReviewActor(fixture.SubjectId, false, CanParticipate: true), fixture.Version, "Summary",
                [new(ReviewItemKind.Competency, fixture.CompetencyId, null, null, null, null),
                 new(ReviewItemKind.Objective, fixture.ObjectiveId, "Reflection", 4, null, null)]), default);
            Assert.True(missing.IsFailure);
            Assert.Contains("1 rating", missing.Error.Message, StringComparison.OrdinalIgnoreCase);
        }

        await using (var db = store.NewContext())
        {
            var save = new SaveSelfAssessmentHandler(db, new TestPerformanceAudit(db));
            var offScale = await save.Handle(new(fixture.ReviewId, new ReviewActor(fixture.SubjectId, false, CanParticipate: true), fixture.Version, "Draft",
                [new(ReviewItemKind.Competency, fixture.CompetencyId, null, 99, null, null)]), default);
            Assert.True(offScale.IsFailure);
            Assert.Contains("snapshotted scale", offScale.Error.Message, StringComparison.OrdinalIgnoreCase);
        }

        await using (var db = store.NewContext())
        {
            var submit = new SubmitSelfAssessmentHandler(db, new TestPerformanceAudit(db), new PerformanceNotifications(db));
            var complete = await submit.Handle(new(fixture.ReviewId, new ReviewActor(fixture.SubjectId, false, CanParticipate: true), fixture.Version, "Summary",
                [new(ReviewItemKind.Competency, fixture.CompetencyId, null, 3, "Useful behavior", null),
                 new(ReviewItemKind.Objective, fixture.ObjectiveId, "Delivered milestones", 4, null, null)]) { OverallRating = 4 }, default);
            Assert.True(complete.IsSuccess, complete.IsFailure ? complete.Error.Message : null);
        }

        await using (var db = store.NewContext())
        {
            var objective = await db.Objectives.SingleAsync(item => item.Id == fixture.ObjectiveId);
            Assert.Equal(30m, objective.DerivedProgress);
            Assert.Equal(MeasurementMethod.ManualPercentage, objective.Measurement!.Method);
            Assert.Equal(1, await db.ProgressUpdates.CountAsync(item => item.ObjectiveId == fixture.ObjectiveId));
            var reviewer = await new SubmitManagerAssessmentHandler(db, new TestPerformanceAudit(db), new PerformanceNotifications(db))
                .Handle(new(fixture.ReviewId, new ReviewActor(fixture.ReviewerId, false, CanReviewReports: true), fixture.Version, "Manager summary", 4,
                    [new(ReviewItemKind.Competency, fixture.CompetencyId, null, 4, null, "Coaches peers"),
                     new(ReviewItemKind.Objective, fixture.ObjectiveId, null, 5, null, "Exceeded target")]), default);
            Assert.True(reviewer.IsSuccess, reviewer.IsFailure ? reviewer.Error.Message : null);

            objective.ApplyManualPercentage(65m);
            await db.SaveChangesAsync();
        }

        await using (var db = store.NewContext())
        {
            var composed = await new GetPerformanceReviewHandler(db).Handle(
                new(fixture.ReviewId, new ReviewActor(fixture.SubjectId, false)), default);
            Assert.True(composed.IsSuccess);
            Assert.True(composed.Value.HasApprovedPlan);
            var objective = Assert.Single(composed.Value.Items, item => item.Kind == ReviewItemKind.Objective);
            Assert.Equal(65m, objective.Progress);
            Assert.Contains("Incident postmortem", objective.EvidenceSummary.Select(reference => reference.Label));
            Assert.Equal(1, objective.EvidenceCount);
            Assert.Equal(EvidenceKind.Reference, Assert.Single(objective.EvidenceSummary).Kind);
            Assert.Equal(MeasurementMethod.ManualPercentage, objective.Measurement!.Method);
            Assert.Equal(3, Assert.Single(composed.Value.Items, item => item.Kind == ReviewItemKind.Competency).SelfRating);
            Assert.Null(Assert.Single(composed.Value.Items, item => item.Kind == ReviewItemKind.Competency).ManagerRating);
        }
    }

    [Fact]
    public async Task Review_composer_returns_explicit_no_approved_plan_state()
    {
        var store = TestStore.ForNewTenant();
        var fixture = await SeedAsync(store, approvedPlan: false);
        await using var db = store.NewContext();
        var composed = await new GetPerformanceReviewHandler(db).Handle(
            new(fixture.ReviewId, new ReviewActor(fixture.SubjectId, false)), default);
        Assert.True(composed.IsSuccess);
        Assert.False(composed.Value.HasApprovedPlan);
        Assert.DoesNotContain(composed.Value.Items, item => item.Kind == ReviewItemKind.Objective);
        Assert.Single(composed.Value.Items, item => item.Kind == ReviewItemKind.Competency);
    }

    private static async Task<Fixture> SeedAsync(TestStore store, bool approvedPlan)
    {
        var subjectId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var cycle = PerformanceCycle.CreateDraft(store.TenantId, "FY26", Start, End, Start.AddDays(30)).Activated();
        var participant = Participant.Create(store.TenantId, cycle.Id, subjectId, "Subject", null, null, null,
            reviewerId, "Reviewer", false, Start);
        var round = ReviewRound.CreateDraft(store.TenantId, cycle, "Mid-year", Start, End, true, true, false);
        var competencyId = Guid.NewGuid();
        round.UpdateDraft(cycle, "Mid-year", Start, End, true, true, false, Start.AddDays(100), End,
            System.Text.Json.JsonSerializer.Serialize(new[] { competencyId }));
        var roundSubject = ReviewRoundSubject.Create(store.TenantId, round.Id, participant, reviewerId, "Reviewer");
        var scale = RatingScale.CreateDefault(store.TenantId);
        var scaleVersion = scale.CreateNextVersion(RatingScaleDefaults.Levels);
        var review = PerformanceReview.Open(store.TenantId, round, roundSubject, scaleVersion.Id,
            scaleVersion.LevelsJson, DateTime.UtcNow);
        round.Launch(System.Text.Json.JsonSerializer.Serialize(new
        {
            competencies = new[] { new { id = competencyId, name = "Develops others", description = "Builds capability", behaviors = new[] { "Coaches peers" } } },
        }), scaleVersion.Id, DateTime.UtcNow);

        EmployeePlan? plan = null;
        Objective? objective = null;
        if (approvedPlan)
        {
            plan = EmployeePlan.Create(store.TenantId, cycle.Id, participant.Id, subjectId, "Subject", null, reviewerId, "Reviewer");
            plan.Submit(subjectId, new PlanSubmissionFacts(1, true, 100m, false, true, PlanAlignmentPolicy.Optional));
            plan.Approve(reviewerId);
            objective = Objective.CreateEmployee(store.TenantId, cycle.Id, plan.Id, subjectId,
                "Improve service reliability", "Reduce recurring incidents", null, Start, End,
                ObjectiveMeasurement.ManualPercentage(), 100m, null, null, Start, End);
            objective.ApplyManualPercentage(30m);
        }

        await using var db = store.NewContext();
        db.Cycles.Add(cycle);
        db.Participants.Add(participant);
        db.RatingScales.Add(scale);
        db.RatingScaleVersions.Add(scaleVersion);
        db.ReviewRounds.Add(round);
        db.ReviewRoundSubjects.Add(roundSubject);
        db.PerformanceReviews.Add(review);
        if (plan is not null) db.EmployeePlans.Add(plan);
        if (objective is not null) db.Objectives.Add(objective);
        if (objective is not null)
        {
            var update = ProgressUpdate.RecordPercentage(store.TenantId, cycle.Id, objective.Id, subjectId, 30m, EY.HRPlatform.Performance.Domain.Progress.ObjectiveStatus.OnTrack, null, false, false);
            update.AttachEvidence(EvidenceItem.Reference(store.TenantId, "Incident postmortem"));
            db.ProgressUpdates.Add(update);
        }
        await db.SaveChangesAsync();
        return new(review.Id, subjectId, reviewerId, competencyId, objective?.Id ?? Guid.Empty, review.Version);
    }

    private sealed record Fixture(Guid ReviewId, Guid SubjectId, Guid ReviewerId, Guid CompetencyId, Guid ObjectiveId, uint Version);
}
