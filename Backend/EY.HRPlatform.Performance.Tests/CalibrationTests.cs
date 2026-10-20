using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Calibration;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Reviews;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Features.Settings;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

public sealed class CalibrationTests
{
    private static readonly DateOnly Start = new(2026, 1, 1);
    private static readonly DateOnly End = new(2026, 12, 31);

    // Default scale: 1 Needs improvement, 2 Developing, 3 Effective, 4 Strong, 5 Exceptional.
    private static readonly FacilitatorIdentity Hr = new(Guid.NewGuid(), null, "QA Admin");
    private static readonly FacilitatorIdentity Head = new(Guid.NewGuid(), Guid.NewGuid(), "Head of People");

    [Fact]
    public async Task Opening_requires_an_active_calibration_round_and_allows_one_session()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var disabled = await SeedAsync(db, store, reviewCount: 1, calibration: false);
        var rejected = await Open(db).Handle(new(disabled.Round.Id, Hr, true), default);
        Assert.Equal(PerformanceErrors.Codes.CalibrationNotAvailable, rejected.Error.Code);

        var store2 = TestStore.ForNewTenant();
        await using var db2 = store2.NewContext();
        var world = await SeedAsync(db2, store2, reviewCount: 2);
        await SubmitManagerAsync(db2, world.Reviews[0], 4);
        var opened = await Open(db2).Handle(new(world.Round.Id, Hr, true), default);
        Assert.True(opened.IsSuccess);
        Assert.Equal(Hr.UserId, Assert.Single(opened.Value.Facilitators).UserId);
        // A review already in calibration joins at open, with the manager's rating as its original.
        var subject = Assert.Single(await db2.CalibrationSubjects.AsNoTracking().ToListAsync());
        Assert.Equal((world.Reviews[0].Id, 4), (subject.ReviewId, subject.OriginalRating));
        Assert.Equal(1, opened.Value.Counts.Outstanding);

        var second = await Open(db2).Handle(new(world.Round.Id, Hr, true), default);
        Assert.True(second.IsSuccess);
        Assert.Equal(opened.Value.Id, second.Value.Id);
    }

    [Fact]
    public async Task Manager_submission_joins_the_session_and_facilitators_are_told_once_when_all_arrive()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await SeedAsync(db, store, reviewCount: 2);
        var opened = await Open(db).Handle(new(world.Round.Id, Hr, true), default);
        var holders = new FakePermissionHoldersClient();
        holders.Holders.AddRange([Holder(Hr), Holder(Head)]);
        Assert.True((await new SetCalibrationFacilitatorsHandler(db, holders, new TestPerformanceAudit(db))
            .Handle(new(world.Round.Id, Hr, [Hr.UserId, Head.UserId], opened.Value.Version, true), default)).IsSuccess);

        await SubmitManagerAsync(db, world.Reviews[0], 4);
        Assert.Equal(0, await db.OutboxMessages.CountAsync(message => message.Kind == PerformanceNotificationKind.CalibrationReady));
        await SubmitManagerAsync(db, world.Reviews[1], 3);

        Assert.Equal(2, await db.CalibrationSubjects.CountAsync());
        var ready = await db.OutboxMessages.Where(message => message.Kind == PerformanceNotificationKind.CalibrationReady).ToListAsync();
        Assert.Equal(2, ready.Count);
        // The administrator has no employee record, so no Core work email: recorded as skipped.
        Assert.Equal("no-work-email", ready.Single(message => message.RecipientEmployeeId == Guid.Empty).SkippedReason);
        Assert.True(ready.Single(message => message.RecipientEmployeeId == Head.EmployeeId).IsPending);
    }

    [Fact]
    public async Task Facilitators_must_hold_the_grant_and_be_named()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await SeedAsync(db, store, reviewCount: 1);
        var opened = await Open(db).Handle(new(world.Round.Id, Hr, true), default);
        var holders = new FakePermissionHoldersClient();
        holders.Holders.Add(Holder(Hr));

        var notHolder = await new SetCalibrationFacilitatorsHandler(db, holders, new TestPerformanceAudit(db))
            .Handle(new(world.Round.Id, Hr, [Hr.UserId, Head.UserId], opened.Value.Version, true), default);
        Assert.Equal(PerformanceErrors.Codes.CalibrationFacilitatorInvalid, notHolder.Error.Code);

        // A capability holder who is not named cannot read the session.
        var unnamed = await new GetCalibrationSessionHandler(db).Handle(new(world.Round.Id, Head, true), default);
        Assert.Equal(PerformanceErrors.Codes.CalibrationForbidden, unnamed.Error.Code);
    }

    [Fact]
    public async Task Adjustments_need_a_rationale_keep_history_and_never_touch_the_manager_rating()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await SeedAsync(db, store, reviewCount: 1);
        await SubmitManagerAsync(db, world.Reviews[0], 4);
        await Open(db).Handle(new(world.Round.Id, Hr, true), default);
        var review = world.Reviews[0];

        var noReason = await Adjust(db, world, review.Id, 3, null);
        Assert.Equal(PerformanceErrors.Codes.CalibrationInvalid, noReason.Error.Code);
        var offScale = await Adjust(db, world, review.Id, 9, "Out of range");
        Assert.Equal(PerformanceErrors.Codes.CalibrationInvalid, offScale.Error.Code);

        var lowered = await Adjust(db, world, review.Id, 3, "Peer outcomes were stronger", CalibrationDiscussionState.Discussed);
        Assert.True(lowered.IsSuccess);
        Assert.Equal((4, 3, true), (lowered.Value.OriginalRating, lowered.Value.CurrentRating, lowered.Value.Adjusted));
        var change = Assert.Single(lowered.Value.History);
        Assert.Equal((4, 3, "QA Admin", "Peer outcomes were stronger"), (change.PreviousRating, change.NewRating, change.ActorDisplayName, change.Rationale));

        var restored = await Adjust(db, world, review.Id, 4, null, CalibrationDiscussionState.Discussed);
        Assert.True(restored.IsSuccess);
        Assert.False(restored.Value.Adjusted);
        Assert.Equal(2, restored.Value.History.Count);
        Assert.Equal(4, await db.PerformanceReviews.Where(item => item.Id == review.Id).Select(item => item.ManagerAssessment.OverallRating).SingleAsync());
        Assert.Equal(2, await db.AuditEntries.CountAsync(entry => entry.Action == PerformanceAuditActions.CalibrationSubjectChanged));
    }

    [Fact]
    public async Task Finalizing_waits_for_every_review_then_sets_outcomes_once_without_a_distribution_rule()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await SeedAsync(db, store, reviewCount: 3);
        await SubmitManagerAsync(db, world.Reviews[0], 4);
        await SubmitManagerAsync(db, world.Reviews[1], 4);
        await Open(db).Handle(new(world.Round.Id, Hr, true), default);

        var early = await Finalize(db, world);
        Assert.Equal(PerformanceErrors.Codes.CalibrationOutstandingReviews, early.Error.Code);

        // Every subject ends up Strong: a skewed distribution is not a reason to refuse.
        await SubmitManagerAsync(db, world.Reviews[2], 3);
        await Adjust(db, world, world.Reviews[2].Id, 4, "Delivered the platform migration");
        var finalized = await Finalize(db, world);
        Assert.True(finalized.IsSuccess);
        Assert.Equal(CalibrationSessionState.Finalized, finalized.Value.State);
        Assert.All(finalized.Value.Distribution.Where(level => level.Value != 4), level => Assert.Equal(0, level.Current));

        var reviews = await db.PerformanceReviews.OrderBy(item => item.SubjectDisplayName).ToListAsync();
        Assert.All(reviews, item => Assert.Equal(PerformanceReviewState.ReadyToFinalize, item.State));
        Assert.Equal(FinalRatingSources.Calibration, reviews.Single(item => item.Id == world.Reviews[2].Id).FinalRatingSource);
        Assert.Equal(FinalRatingSources.Manager, reviews.Single(item => item.Id == world.Reviews[0].Id).FinalRatingSource);

        var retry = await Finalize(db, world, expectedVersion: 0);
        Assert.True(retry.IsSuccess);
        Assert.Equal(1, await db.AuditEntries.CountAsync(entry => entry.Action == PerformanceAuditActions.CalibrationFinalized));

        var locked = await Adjust(db, world, world.Reviews[0].Id, 3, "Too late");
        Assert.False(locked.IsSuccess);
    }

    [Fact]
    public async Task Review_finalization_releases_the_calibrated_rating_and_hides_it_until_then()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await SeedAsync(db, store, reviewCount: 1);
        var review = world.Reviews[0];
        await SubmitManagerAsync(db, review, 4);
        await Open(db).Handle(new(world.Round.Id, Hr, true), default);
        await Adjust(db, world, review.Id, 3, "Calibrated against peers");
        await Finalize(db, world);

        var beforeRelease = await new GetPerformanceReviewHandler(db).Handle(
            new GetPerformanceReviewQuery(review.Id, new ReviewActor(review.SubjectEmployeeId, false)), default);
        Assert.Null(beforeRelease.Value.FinalRating);

        var released = await new FinalizeReviewHandler(db, new TestPerformanceAudit(db), new PerformanceNotifications(db))
            .Handle(new FinalizeReviewCommand(review.Id, review.Version), default);
        Assert.True(released.IsSuccess);
        Assert.Equal((3, FinalRatingSources.Calibration), (released.Value.FinalRating, released.Value.FinalRatingSource));
        var subjectView = await new GetPerformanceReviewHandler(db).Handle(
            new GetPerformanceReviewQuery(review.Id, new ReviewActor(review.SubjectEmployeeId, false)), default);
        Assert.Equal(3, subjectView.Value.FinalRating);
        Assert.Null(subjectView.Value.ManagerAssessment!.OverallRating);
    }

    [Fact]
    public async Task Facilitators_editing_different_subjects_do_not_collide()
    {
        var store = TestStore.ForNewTenant();
        Seeded world;
        await using (var setup = store.NewContext())
        {
            world = await SeedAsync(setup, store, reviewCount: 2);
            await SubmitManagerAsync(setup, world.Reviews[0], 4);
            await SubmitManagerAsync(setup, world.Reviews[1], 2);
            await Open(setup).Handle(new(world.Round.Id, Hr, true), default);
        }

        await using var first = store.NewContext();
        await using var second = store.NewContext();
        var a = await Adjust(first, world, world.Reviews[0].Id, 3, "Calibrated down");
        var b = await Adjust(second, world, world.Reviews[1].Id, 3, "Calibrated up");
        Assert.True(a.IsSuccess && b.IsSuccess);
    }

    private static OpenCalibrationSessionHandler Open(PerformanceDbContext db)
        => new(db, new TestPerformanceAudit(db), new PerformanceNotifications(db));

    private static async Task<SharedKernel.Results.Result<CalibrationSubjectDto>> Adjust(PerformanceDbContext db, Seeded world, Guid reviewId,
        int rating, string? rationale, CalibrationDiscussionState discussion = CalibrationDiscussionState.NotDiscussed)
    {
        var version = await db.CalibrationSubjects.AsNoTracking().Where(subject => subject.ReviewId == reviewId).Select(subject => subject.Version).SingleAsync();
        return await new AdjustCalibrationSubjectHandler(db, new TestPerformanceAudit(db))
            .Handle(new(world.Round.Id, reviewId, Hr, rating, rationale, discussion, version, true), default);
    }

    private static async Task<SharedKernel.Results.Result<CalibrationSessionDto>> Finalize(PerformanceDbContext db, Seeded world, uint? expectedVersion = null)
    {
        var version = expectedVersion ?? await db.CalibrationSessions.AsNoTracking().Select(session => session.Version).SingleAsync();
        return await new FinalizeCalibrationSessionHandler(db, new TestPerformanceAudit(db), new PerformanceNotifications(db)).Handle(new(world.Round.Id, Hr, version, true), default);
    }

    private static async Task SubmitManagerAsync(PerformanceDbContext db, PerformanceReview review, int rating)
    {
        var result = await new SubmitManagerAssessmentHandler(db, new TestPerformanceAudit(db), new PerformanceNotifications(db))
            .Handle(new SubmitManagerAssessmentCommand(review.Id, new ReviewActor(review.ReviewerEmployeeId, false, CanReviewReports: true),
                review.Version, "Assessment", rating), default);
        Assert.True(result.IsSuccess, result.IsSuccess ? null : result.Error.Message);
    }

    private static PermissionHolder Holder(FacilitatorIdentity identity)
        => new(identity.UserId, identity.EmployeeId, identity.DisplayName, $"{identity.UserId:N}@example.test");

    private static async Task<Seeded> SeedAsync(PerformanceDbContext db, TestStore store, int reviewCount, bool calibration = true)
    {
        var cycle = PerformanceCycle.CreateDraft(store.TenantId, "FY26", Start, End, Start.AddDays(30)).Activated();
        var round = ReviewRound.CreateDraft(store.TenantId, cycle, "Year-end", Start, End, false, false, calibration);
        round.UpdateDraft(cycle, "Year-end", Start, End, false, false, calibration, null, End, "[]");
        var scale = RatingScale.CreateDefault(store.TenantId);
        var version = scale.CreateNextVersion(RatingScaleDefaults.Levels);
        var participants = new List<Participant>();
        var subjects = new List<ReviewRoundSubject>();
        var reviews = new List<PerformanceReview>();
        for (var i = 0; i < reviewCount; i++)
        {
            var orgUnitId = Guid.NewGuid();
            var participant = Participant.Create(store.TenantId, cycle.Id, Guid.NewGuid(), $"Subject {i}", "Legacy role", Guid.NewGuid(), "Legacy org",
                Guid.NewGuid(), "Reviewer", false, Start);
            var subject = ReviewRoundSubject.Create(store.TenantId, round.Id, participant, participant.ManagerEmployeeId, "Reviewer");
            participants.Add(participant);
            subjects.Add(subject);
            reviews.Add(PerformanceReview.Open(store.TenantId, round, subject, version.Id, version.LevelsJson,
                participant.DisplayName, "Principal Engineer", orgUnitId, $"Snapshot org {i}", "Reviewer", subject.ReviewerBasis, DateTime.UtcNow));
        }
        round.Launch("{\"competencies\":[]}", version.Id, DateTime.UtcNow);
        db.Cycles.Add(cycle);
        db.Participants.AddRange(participants);
        db.RatingScales.Add(scale);
        db.RatingScaleVersions.Add(version);
        db.ReviewRounds.Add(round);
        db.ReviewRoundSubjects.AddRange(subjects);
        db.PerformanceReviews.AddRange(reviews);
        await db.SaveChangesAsync();
        return new(round, reviews);
    }

    private sealed record Seeded(ReviewRound Round, IReadOnlyList<PerformanceReview> Reviews);
}
