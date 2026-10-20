using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Reviews;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Features.Settings;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using Microsoft.EntityFrameworkCore.Diagnostics;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Npgsql;

namespace EY.HRPlatform.Performance.Tests;

public sealed class CalibrationRelationalTests
{
    private static readonly DateOnly Start = new(2026, 1, 1);
    private static readonly FacilitatorIdentity Hr = new(Guid.NewGuid(), null, "QA Admin");

    [RelationalDatabaseFact]
    public async Task Calibration_migration_enforces_one_session_and_per_subject_versions_then_rolls_back()
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_PERFORMANCE_RELATIONAL_TEST_CONNECTION")!;
        var databaseName = $"fusion_perf_{Guid.NewGuid():N}";
        var connection = new NpgsqlConnectionStringBuilder(baseConnection) { Database = databaseName, Pooling = false }.ConnectionString;
        var tenantId = Guid.NewGuid();
        try
        {
            await RelationalTests.CreateDatabaseAsync(baseConnection, databaseName);
            Guid roundId, firstReview, secondReview;
            await using (var db = RelationalTests.CreateDb(connection, tenantId))
            {
                await db.Database.MigrateAsync();
                var cycle = PerformanceCycle.CreateDraft(tenantId, "FY26", Start, Start.AddYears(1).AddDays(-1), Start.AddDays(30)).Activated();
                var round = ReviewRound.CreateDraft(tenantId, cycle, "Year-end", Start, Start.AddMonths(11), false, false, true);
                var scale = RatingScale.CreateDefault(tenantId);
                var version = scale.CreateNextVersion(RatingScaleDefaults.Levels);
                var reviews = new List<PerformanceReview>();
                db.Cycles.Add(cycle);
                for (var i = 0; i < 2; i++)
                {
                    var participant = Participant.Create(tenantId, cycle.Id, Guid.NewGuid(), $"Subject {i}", null, null, null, Guid.NewGuid(), "Reviewer", false, Start);
                    var subject = ReviewRoundSubject.Create(tenantId, round.Id, participant, participant.ManagerEmployeeId, "Reviewer");
                    db.Participants.Add(participant);
                    db.ReviewRoundSubjects.Add(subject);
                    reviews.Add(PerformanceReview.Open(tenantId, round, subject, version.Id, version.LevelsJson, DateTime.UtcNow));
                }
                round.Launch("{\"competencies\":[]}", version.Id, DateTime.UtcNow);
                foreach (var review in reviews) review.SubmitManagerAssessment(review.ReviewerEmployeeId, "Assessment", 4, DateTime.UtcNow);
                db.RatingScales.Add(scale);
                db.RatingScaleVersions.Add(version);
                db.ReviewRounds.Add(round);
                db.PerformanceReviews.AddRange(reviews);
                var session = CalibrationSession.Open(tenantId, round, Hr, new NineBoxBands(2, 3), DateTime.UtcNow);
                db.CalibrationSessions.Add(session);
                db.CalibrationSubjects.AddRange(reviews.Select(session.AddSubject));
                await db.SaveChangesAsync();
                (roundId, firstReview, secondReview) = (round.Id, reviews[0].Id, reviews[1].Id);

                db.CalibrationSessions.Add(CalibrationSession.Open(tenantId, round, Hr, new NineBoxBands(2, 3), DateTime.UtcNow));
                await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
            }

            // Two facilitators: different subjects both land; the same subject read stale is refused.
            await using (var a = RelationalTests.CreateDb(connection, tenantId))
            await using (var b = RelationalTests.CreateDb(connection, tenantId))
            {
                var scale = RatingScaleDefaults.Levels.Select(level => level.Value).ToArray();
                var sessionA = await a.CalibrationSessions.SingleAsync();
                var sessionB = await b.CalibrationSessions.SingleAsync();
                var subjectA = await a.CalibrationSubjects.SingleAsync(item => item.ReviewId == firstReview);
                var otherB = await b.CalibrationSubjects.SingleAsync(item => item.ReviewId == secondReview);
                var staleB = await b.CalibrationSubjects.SingleAsync(item => item.ReviewId == firstReview);
                a.CalibrationAdjustments.Add(subjectA.Apply(sessionA, 3, "Peers", CalibrationDiscussionState.Discussed, scale, Hr, DateTime.UtcNow)!);
                await a.SaveChangesAsync();
                b.CalibrationAdjustments.Add(otherB.Apply(sessionB, 5, "Exceptional year", CalibrationDiscussionState.NotDiscussed, scale, Hr, DateTime.UtcNow)!);
                b.Entry(staleB).State = EntityState.Unchanged;
                await b.SaveChangesAsync();
                staleB.Apply(sessionB, 2, "Conflicting view", CalibrationDiscussionState.NotDiscussed, scale, Hr, DateTime.UtcNow);
                await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => b.SaveChangesAsync());
            }

            await using (var db = RelationalTests.CreateDb(connection, tenantId))
            {
                var migrations = db.Database.GetMigrations().ToArray();
                var index = Array.FindIndex(migrations, m => m.EndsWith("_AddCalibrationSessions"));
                Assert.True(index > 0);
                await db.GetService<Microsoft.EntityFrameworkCore.Migrations.IMigrator>().MigrateAsync(migrations[index - 1]);
                Assert.Equal(0, await db.Database.SqlQueryRaw<int>("""
                    SELECT count(*)::int AS "Value" FROM information_schema.tables
                    WHERE table_schema='performance' AND table_name LIKE 'Calibration%'
                    """).SingleAsync());
                Assert.NotEqual(Guid.Empty, roundId);
            }
        }
        finally { await RelationalTests.DropDatabaseAsync(baseConnection, databaseName); }
    }
    /// <summary>
    /// The last two manager assessments of a round commit together. Inside its own transaction each sees the
    /// other still outstanding; the check after commit still tells the facilitators, exactly once.
    /// </summary>
    [RelationalDatabaseFact]
    public async Task Simultaneous_last_submissions_tell_the_facilitators_exactly_once()
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_PERFORMANCE_RELATIONAL_TEST_CONNECTION")!;
        var databaseName = $"fusion_perf_{Guid.NewGuid():N}";
        var connection = new NpgsqlConnectionStringBuilder(baseConnection) { Database = databaseName, Pooling = false }.ConnectionString;
        var tenantId = Guid.NewGuid();
        var facilitator = new FacilitatorIdentity(Guid.NewGuid(), Guid.NewGuid(), "Hana");
        try
        {
            await RelationalTests.CreateDatabaseAsync(baseConnection, databaseName);
            var reviews = new List<PerformanceReview>();
            await using (var db = RelationalTests.CreateDb(connection, tenantId))
            {
                await db.Database.MigrateAsync();
                var cycle = PerformanceCycle.CreateDraft(tenantId, "FY26", Start, Start.AddYears(1).AddDays(-1), Start.AddDays(30)).Activated();
                var round = ReviewRound.CreateDraft(tenantId, cycle, "Year-end", Start, Start.AddMonths(11), false, false, true);
                var scale = RatingScale.CreateDefault(tenantId);
                var version = scale.CreateNextVersion(RatingScaleDefaults.Levels);
                db.Cycles.Add(cycle);
                for (var i = 0; i < 2; i++)
                {
                    var participant = Participant.Create(tenantId, cycle.Id, Guid.NewGuid(), $"Subject {i}", null, null, null, Guid.NewGuid(), "Reviewer", false, Start);
                    var subject = ReviewRoundSubject.Create(tenantId, round.Id, participant, participant.ManagerEmployeeId, "Reviewer");
                    db.Participants.Add(participant);
                    db.ReviewRoundSubjects.Add(subject);
                    reviews.Add(PerformanceReview.Open(tenantId, round, subject, version.Id, version.LevelsJson, DateTime.UtcNow));
                }
                round.Launch("{\"competencies\":[]}", version.Id, DateTime.UtcNow);
                db.RatingScales.Add(scale);
                db.RatingScaleVersions.Add(version);
                db.ReviewRounds.Add(round);
                db.PerformanceReviews.AddRange(reviews);
                db.CalibrationSessions.Add(CalibrationSession.Open(tenantId, round, facilitator, new NineBoxBands(2, 3), DateTime.UtcNow));
                await db.SaveChangesAsync();
            }

            var gate = new AsyncGate(2);
            async Task SubmitAsync(PerformanceReview review)
            {
                await using var db = RelationalTests.CreateDb(connection, tenantId, new HoldFirstSave(gate));
                var version = (await db.PerformanceReviews.AsNoTracking().SingleAsync(item => item.Id == review.Id)).Version;
                var handler = new SubmitManagerAssessmentHandler(db, new TestPerformanceAudit(db), new PerformanceNotifications(db));
                var result = await handler.Handle(new SubmitManagerAssessmentCommand(review.Id,
                    new ReviewActor(review.ReviewerEmployeeId, false, CanReviewReports: true), version, "Assessment", 4), default);
                Assert.True(result.IsSuccess, result.IsFailure ? result.Error.Message : null);
            }
            await Task.WhenAll(reviews.Select(review => Task.Run(() => SubmitAsync(review))));

            await using var check = RelationalTests.CreateDb(connection, tenantId);
            Assert.All(await check.PerformanceReviews.ToListAsync(), review => Assert.Equal(PerformanceReviewState.Calibration, review.State));
            Assert.NotNull((await check.CalibrationSessions.SingleAsync()).ReadyNotifiedAt);
            Assert.Single(await check.OutboxMessages.Where(message => message.Kind == PerformanceNotificationKind.CalibrationReady).ToListAsync());
        }
        finally { await RelationalTests.DropDatabaseAsync(baseConnection, databaseName); }
    }

    /// <summary>Holds a context's first save until every party has reached its own.</summary>
    private sealed class HoldFirstSave(AsyncGate gate) : SaveChangesInterceptor
    {
        private bool _held;
        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (!_held)
            {
                _held = true;
                await gate.ArriveAndWaitAsync();
            }
            return result;
        }
    }

    private sealed class AsyncGate(int parties)
    {
        private int _arrived;
        private readonly TaskCompletionSource _all = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public Task ArriveAndWaitAsync()
        {
            if (Interlocked.Increment(ref _arrived) == parties) _all.SetResult();
            return _all.Task.WaitAsync(TimeSpan.FromSeconds(30));
        }
    }
}
