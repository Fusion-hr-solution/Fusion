using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Reviews;
using EY.HRPlatform.Performance.Features.Settings;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

public sealed class ReviewRoundsTests
{
    private static readonly DateOnly Start = new(2026, 1, 1);
    private static readonly DateOnly End = new(2026, 12, 31);
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    [Fact]
    public void Review_history_rating_label_comes_from_the_finalized_scale_snapshot()
    {
        const string snapshot = "{\"ratingScale\":[{\"value\":1,\"label\":\"Needs support\"},{\"value\":3,\"label\":\"Strong\"}]}";
        Assert.Equal("Strong", ReviewHistoryRating.Label(snapshot, 3));
        Assert.Null(ReviewHistoryRating.Label(snapshot, 4));
    }

    [Fact]
    public async Task Create_requires_active_cycle_and_copies_defaults_and_confirmed_roster_responsibility()
    {
        var draftStore = TestStore.ForNewTenant();
        var cycle = PerformanceCycle.CreateDraft(draftStore.TenantId, "FY26", Start, End, Start.AddDays(30));
        await using (var db = draftStore.NewContext())
        {
            db.Cycles.Add(cycle);
            await db.SaveChangesAsync();
            var rejected = await new CreateReviewRoundHandler(db, draftStore.Tenant, new TestPerformanceAudit(db), new FakeCoreWorkforceClient())
                .Handle(new(cycle.Id, new("Mid-year", Start, End)), default);
            Assert.True(rejected.IsFailure);
        }

        var store = TestStore.ForNewTenant();
        cycle = PerformanceCycle.CreateDraft(store.TenantId, "FY26", Start, End, Start.AddDays(30));
        cycle.Activated();
        var participant = Participant.Create(store.TenantId, cycle.Id, Guid.NewGuid(), "Subject", null, null, null,
            Guid.NewGuid(), "Recorded reviewer", false, Start, ReviewerBasis.CoreManagerAtCycleStart);
        await using (var db = store.NewContext())
        {
            db.Cycles.Add(cycle);
            db.Participants.Add(participant);
            db.CycleSettings.Add(CycleSettings.CreateDefault(store.TenantId));
            await db.SaveChangesAsync();
        }
        await using (var db = store.NewContext())
        {
            var result = await new CreateReviewRoundHandler(db, store.Tenant, new TestPerformanceAudit(db), new FakeCoreWorkforceClient())
                .Handle(new(cycle.Id, new("Mid-year", Start, End)), default);
            Assert.True(result.IsSuccess);
            Assert.True(result.Value.SelfAssessmentEnabled);
            Assert.True(result.Value.ObjectiveRatingsEnabled);
            Assert.False(result.Value.CalibrationEnabled);
            var subject = Assert.Single(result.Value.Subjects);
            Assert.Equal(participant.EmployeeId, subject.SubjectEmployeeId);
            Assert.Equal(participant.ManagerEmployeeId, subject.ReviewerEmployeeId);
            Assert.Equal(ReviewerBasis.CoreManagerAtCycleStart, subject.ReviewerBasis);
        }
    }

    [Fact]
    public void Period_must_fit_inside_cycle()
    {
        var tenant = Guid.NewGuid();
        var cycle = PerformanceCycle.CreateDraft(tenant, "FY26", Start, End, Start.AddDays(30)).Activated();
        Assert.Throws<ArgumentException>(() => ReviewRound.CreateDraft(tenant, cycle, "Mid-year", Start.AddDays(-1), End, true, true, false));
        Assert.Throws<ArgumentException>(() => ReviewRound.CreateDraft(tenant, cycle, "Mid-year", Start, End.AddDays(1), true, true, false));
        Assert.Throws<ArgumentException>(() => ReviewRound.CreateDraft(tenant, cycle, "Mid-year", End, Start, true, true, false));
    }

    [Fact]
    public void Exclusion_requires_reason_and_administrative_assignment_captures_basis()
    {
        var tenant = Guid.NewGuid();
        var cycle = PerformanceCycle.CreateDraft(tenant, "FY26", Start, End, Start.AddDays(30)).Activated();
        var round = ReviewRound.CreateDraft(tenant, cycle, "Mid-year", Start, End, true, true, false);
        var participant = Participant.Create(tenant, cycle.Id, Guid.NewGuid(), "Subject", null, null, null,
            Guid.NewGuid(), "Recorded reviewer", false, Start);
        var row = ReviewRoundSubject.Create(tenant, round.Id, participant, participant.ManagerEmployeeId, participant.ManagerDisplayName);
        Assert.Throws<ArgumentException>(() => row.Exclude(round, "  "));
        row.Exclude(round, "Not in scope");
        Assert.True(row.IsExcluded);
        Assert.Equal("Not in scope", row.ExclusionReason);
        Assert.Throws<ArgumentException>(() => row.AssignReviewer(round, participant.EmployeeId, "Subject"));
        row.AssignReviewer(round, Guid.NewGuid(), "Assigned reviewer");
        Assert.Equal(ReviewerBasis.AdministrativeAssignment, row.ReviewerBasis);
        row.Include(round);
        Assert.False(row.IsExcluded);
        Assert.Null(row.ExclusionReason);
    }

    [Fact]
    public async Task Default_reviewer_is_performance_snapshot_even_when_live_core_manager_changes_and_readiness_lists_every_issue()
    {
        var store = TestStore.ForNewTenant();
        var cycle = PerformanceCycle.CreateDraft(store.TenantId, "FY26", Start, End, Start.AddDays(30)).Activated();
        var workforce = new FakeCoreWorkforceClient();
        var liveReviewer = workforce.Add("Current Core manager");
        var recordedReviewer = workforce.Add("Recorded reviewer");
        var inactiveSubject = workforce.Add("Inactive subject", isActive: false);
        var missingReviewer = workforce.Add("Missing reviewer");
        var inactiveReviewer = workforce.Add("Inactive reviewer", isActive: false);
        var self = workforce.Add("Self review");
        var participants = new[]
        {
            Participant.Create(store.TenantId, cycle.Id, inactiveSubject.EmployeeId, inactiveSubject.DisplayName, null, null, null,
                recordedReviewer.EmployeeId, recordedReviewer.DisplayName, false, Start),
            Participant.Create(store.TenantId, cycle.Id, missingReviewer.EmployeeId, missingReviewer.DisplayName, null, null, null,
                null, null, false, Start),
            Participant.Create(store.TenantId, cycle.Id, liveReviewer.EmployeeId, liveReviewer.DisplayName, null, null, null,
                inactiveReviewer.EmployeeId, inactiveReviewer.DisplayName, false, Start),
            Participant.Create(store.TenantId, cycle.Id, self.EmployeeId, self.DisplayName, null, null, null,
                self.EmployeeId, self.DisplayName, false, Start),
        };
        // The live Core org chart now shows a different manager; the roster remains the source of responsibility.
        workforce.ById[participants[0].EmployeeId] = inactiveSubject with { Manager = new(liveReviewer.EmployeeId, liveReviewer.DisplayName, true) };
        Guid roundId;
        await using (var db = store.NewContext())
        {
            db.Cycles.Add(cycle);
            db.Participants.AddRange(participants);
            await db.SaveChangesAsync();
            var created = await new CreateReviewRoundHandler(db, store.Tenant, new TestPerformanceAudit(db), new FakeCoreWorkforceClient())
                .Handle(new(cycle.Id, new("Mid-year", Start, End)), default);
            Assert.True(created.IsSuccess);
            roundId = created.Value.Id;
        }
        await using (var db = store.NewContext())
        {
            var result = await new GetReviewRoundHandler(db, workforce).Handle(new(roundId), default);
            Assert.True(result.IsSuccess);
            var rows = result.Value.Subjects.ToDictionary(s => s.SubjectEmployeeId);
            Assert.Equal(recordedReviewer.EmployeeId, rows[inactiveSubject.EmployeeId].ReviewerEmployeeId);
            Assert.Contains(rows[inactiveSubject.EmployeeId].ReadinessIssues, i => i.Code == "InactiveSubject");
            Assert.Contains(rows[missingReviewer.EmployeeId].ReadinessIssues, i => i.Code == "MissingReviewer");
            Assert.Contains(rows[participants[2].EmployeeId].ReadinessIssues, i => i.Code == "InactiveReviewer");
            Assert.Contains(rows[self.EmployeeId].ReadinessIssues, i => i.Code == "SelfReview");
            Assert.Equal(DateOnly.FromDateTime(DateTime.UtcNow), DateOnly.FromDateTime(workforce.LastAsOf!.Value));
        }
    }

    [Fact]
    public async Task Eligible_reviewers_are_resolved_as_of_today_not_the_round_period_start()
    {
        var store = TestStore.ForNewTenant();
        var cycle = PerformanceCycle.CreateDraft(store.TenantId, "FY26", Start, End, Start.AddDays(30)).Activated();
        var round = ReviewRound.CreateDraft(store.TenantId, cycle, "Mid-year", Start, End, true, true, false);
        var workforce = new FakeCoreWorkforceClient();
        workforce.Add("Reviewer");
        await using var db = store.NewContext();
        db.Cycles.Add(cycle);
        db.ReviewRounds.Add(round);
        await db.SaveChangesAsync();

        var result = await new GetEligibleReviewersHandler(db, workforce).Handle(new(round.Id), default);

        Assert.True(result.IsSuccess);
        Assert.NotNull(workforce.LastAsOf);
        Assert.InRange(workforce.LastAsOf.Value, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddMinutes(1));
    }

    [Fact]
    public async Task Launch_is_idempotent_freezes_scale_starts_manager_stage_and_keeps_deadlines_advisory()
    {
        var store = TestStore.ForNewTenant();
        var cycle = PerformanceCycle.CreateDraft(store.TenantId, "FY26", Start, End, Start.AddDays(30)).Activated();
        var workforce = new FakeCoreWorkforceClient();
        var subject = workforce.Add("Subject");
        var reviewer = workforce.Add("Reviewer");
        var orgUnitId = Guid.NewGuid();
        workforce.ById[subject.EmployeeId] = subject with
        {
            DisplayName = "Subject at launch",
            JobTitle = "Principal Engineer",
            OrgUnit = new WorkforceOrgSnapshot(orgUnitId, "Product Engineering"),
        };
        workforce.ById[reviewer.EmployeeId] = reviewer with { DisplayName = "Reviewer at launch" };
        var participant = Participant.Create(store.TenantId, cycle.Id, subject.EmployeeId, subject.DisplayName, null, null, null,
            reviewer.EmployeeId, reviewer.DisplayName, false, Start);
        var settings = CycleSettings.CreateDefault(store.TenantId);
        settings.Update(settings.DefaultMeasurementMethod, settings.SuggestedObjectiveCountMin,
            settings.SuggestedObjectiveCountMax, settings.PlanningDeadlineOffsetDays, settings.PlanAlignmentPolicy,
            defaultSelfAssessmentEnabled: false);
        var scale = RatingScale.CreateDefault(store.TenantId);
        var originalScale = scale.CreateNextVersion(RatingScaleDefaults.Levels);
        var competency = Competency.Create(store.TenantId, "Develops others", "Builds capability in the team.", ["Coaches colleagues"]);
        ReviewRound round;
        await using var db = store.NewContext();
        db.Cycles.Add(cycle);
        db.Participants.Add(participant);
        db.CycleSettings.Add(settings);
        db.RatingScales.Add(scale);
        db.RatingScaleVersions.Add(originalScale);
        db.Competencies.Add(competency);
        await db.SaveChangesAsync();

        var create = await new CreateReviewRoundHandler(db, store.Tenant, new TestPerformanceAudit(db), new FakeCoreWorkforceClient())
            .Handle(new(cycle.Id, new("Mid-year", Start, End)), default);
        Assert.True(create.IsSuccess);
        var update = create.Value;
        round = await db.ReviewRounds.SingleAsync(r => r.Id == update.Id);
        round.UpdateDraft(cycle, round.Name, round.PeriodStart, round.PeriodEnd,
            round.SelfAssessmentEnabled, round.ObjectiveRatingsEnabled, round.CalibrationEnabled,
            Today.AddDays(5), Today.AddDays(6), System.Text.Json.JsonSerializer.Serialize(new[] { competency.Id }));
        await db.SaveChangesAsync();

        var handler = new LaunchReviewRoundHandler(db, store.Tenant, workforce,
            new TestPerformanceAudit(db), new PerformanceNotifications(db));
        var staleLaunch = await handler.Handle(new(round.Id, round.Version + 1), default);
        Assert.Equal("Performance.Stale", staleLaunch.Error.Code);
        Assert.Equal(0, await db.PerformanceReviews.CountAsync());
        var launched = await handler.Handle(new(round.Id, round.Version), default);
        Assert.True(launched.IsSuccess);
        Assert.Equal(ReviewRoundState.Active, launched.Value.State);
        Assert.Equal(1, launched.Value.ReviewCount);
        var review = await db.PerformanceReviews.SingleAsync();
        Assert.Equal(PerformanceReviewState.ManagerAssessment, review.State);
        Assert.Equal("Subject at launch", review.SubjectDisplayName);
        Assert.Equal("Principal Engineer", review.SubjectJobTitle);
        Assert.Equal(orgUnitId, review.SubjectOrgUnitId);
        Assert.Equal("Product Engineering", review.SubjectOrgUnitName);
        Assert.Equal("Reviewer at launch", review.ReviewerDisplayName);
        Assert.Equal(ReviewerBasis.CoreManagerAtCycleStart, review.ReviewerBasis);
        Assert.Equal(Today.AddDays(6), review.CurrentStageDueDate);
        Assert.Equal(originalScale.Id, review.RatingScaleVersionId);
        Assert.Contains("Exceptional", review.RatingScaleSnapshotJson);
        Assert.Contains(originalScale.Id.ToString(), (await db.ReviewRounds.SingleAsync()).ConfigSnapshotJson);
        var snapshot = (await db.ReviewRounds.SingleAsync()).ConfigSnapshotJson;
        Assert.Contains("Develops others", snapshot);
        Assert.NotNull((await db.Competencies.SingleAsync()).FirstUsedAt);
        var blockedDelete = await new DeleteCompetencyHandler(db, new TestPerformanceAudit(db)).Handle(new(competency.Id, new(competency.Version)), default);
        Assert.Equal("Competency.InUse", blockedDelete.Error.Code);
        await new ArchiveCompetencyHandler(db, new TestPerformanceAudit(db)).Handle(new(competency.Id, new(competency.Version)), default);
        Assert.Equal(snapshot, (await db.ReviewRounds.SingleAsync()).ConfigSnapshotJson);
        Assert.Contains("Coaches colleagues", (await db.ReviewRounds.SingleAsync()).ConfigSnapshotJson);
        var message = await db.OutboxMessages.SingleAsync();
        Assert.Equal(PerformanceNotificationKind.ManagerAssessmentOpened, message.Kind);
        Assert.Equal(reviewer.EmployeeId, message.RecipientEmployeeId);
        var email = PerformanceNotificationRenderer.Render(message, "http://localhost:3000/");
        Assert.Contains($"http://localhost:3000/performance/reviews/{review.Id}", email.Body);

        var changedScale = scale.CreateNextVersion([
            new RatingScaleLevel(1, "Low", null), new RatingScaleLevel(2, "Developing", null),
            new RatingScaleLevel(3, "Effective", null), new RatingScaleLevel(4, "Strong", null), new RatingScaleLevel(5, "High", null),
        ]);
        db.RatingScaleVersions.Add(changedScale);
        await db.SaveChangesAsync();
        var retry = await handler.Handle(new(round.Id, 0), default);
        Assert.True(retry.IsSuccess);
        Assert.Equal(1, retry.Value.ReviewCount);
        Assert.Equal(1, await db.PerformanceReviews.CountAsync());
        Assert.Equal(1, await db.OutboxMessages.CountAsync());
        Assert.Equal(3, await db.AuditEntries.CountAsync());
        Assert.Equal(originalScale.Id, review.RatingScaleVersionId);

        // Time passes: the due date is behind us, and the work stays open (advisory deadlines).
        db.Entry(review).Property(r => r.CurrentStageDueDate).CurrentValue = Today.AddDays(-2);
        await db.SaveChangesAsync();
        var status = await new GetReviewRoundStatusHandler(db).Handle(new(round.Id), default);
        Assert.True(status.IsSuccess);
        Assert.Equal(1, status.Value.OverdueManagerAssessments);
        var work = await new GetReviewWorkHandler(db).Handle(new(cycle.Id, reviewer.EmployeeId, false, true), default);
        Assert.True(work.IsSuccess);
        var item = Assert.Single(work.Value);
        Assert.Equal(PerformanceReviewState.ManagerAssessment, item.State);
        Assert.Equal(Today.AddDays(-2), item.DueDate);

        // A submitted assessment stays on the reviewer's list until finalization, no longer waiting on them.
        Assert.True(review.SubmitManagerAssessment(reviewer.EmployeeId, "Met the goals.", 4, DateTime.UtcNow));
        await db.SaveChangesAsync();
        var afterSubmit = await new GetReviewWorkHandler(db).Handle(new(cycle.Id, reviewer.EmployeeId, false, true), default);
        var submitted = Assert.Single(afterSubmit.Value);
        Assert.Equal(PerformanceReviewState.ReadyToFinalize, submitted.State);
        Assert.False(submitted.IsAssignedToCaller);
    }

    [Fact]
    public async Task Launch_with_self_assessment_opens_subject_stage_and_notifies_subject()
    {
        var store = TestStore.ForNewTenant();
        var cycle = PerformanceCycle.CreateDraft(store.TenantId, "FY26", Start, End, Start.AddDays(30)).Activated();
        var workforce = new FakeCoreWorkforceClient();
        var subject = workforce.Add("Subject");
        var reviewer = workforce.Add("Reviewer");
        var participant = Participant.Create(store.TenantId, cycle.Id, subject.EmployeeId, subject.DisplayName, null, null, null,
            reviewer.EmployeeId, reviewer.DisplayName, false, Start);
        await using var db = store.NewContext();
        db.Cycles.Add(cycle);
        db.Participants.Add(participant);
        db.CycleSettings.Add(CycleSettings.CreateDefault(store.TenantId));
        await db.SaveChangesAsync();
        var created = await new CreateReviewRoundHandler(db, store.Tenant, new TestPerformanceAudit(db), new FakeCoreWorkforceClient())
            .Handle(new(cycle.Id, new("Mid-year", Start, End)), default);
        var result = await new LaunchReviewRoundHandler(db, store.Tenant, workforce,
            new TestPerformanceAudit(db), new PerformanceNotifications(db)).Handle(new(created.Value.Id, created.Value.Version), default);
        Assert.True(result.IsSuccess);
        var review = await db.PerformanceReviews.SingleAsync();
        Assert.Equal(PerformanceReviewState.SelfAssessment, review.State);
        var notification = await db.OutboxMessages.SingleAsync();
        Assert.Equal(PerformanceNotificationKind.SelfAssessmentOpened, notification.Kind);
        Assert.Equal(subject.EmployeeId, notification.RecipientEmployeeId);
    }
}
