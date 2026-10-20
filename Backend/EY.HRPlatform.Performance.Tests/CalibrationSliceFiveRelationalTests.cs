using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Reviews;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Npgsql;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>The slice 5 migration: existing sessions take default bands, subjects and finished reviews keep the manager's potential.</summary>
public sealed class CalibrationSliceFiveRelationalTests
{
    [Fact]
    public async Task Existing_sessions_and_reviews_are_backfilled_and_the_migration_rolls_back()
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_PERFORMANCE_RELATIONAL_TEST_CONNECTION");
        if (string.IsNullOrWhiteSpace(baseConnection)) return;
        var databaseName = $"fusion_perf_s5_{Guid.NewGuid():N}";
        var connection = new NpgsqlConnectionStringBuilder(baseConnection) { Database = databaseName }.ConnectionString;
        var tenantId = Guid.NewGuid();
        var (cycleId, roundId, reviewId, scaleId, versionId, sessionId, subjectId)
            = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        try
        {
            await RelationalTests.CreateDatabaseAsync(baseConnection, databaseName);
            await using var db = RelationalTests.CreateDb(connection, tenantId);
            var migrations = db.Database.GetMigrations().ToArray();
            var current = Array.FindIndex(migrations, m => m.EndsWith("_AddCalibrationPotentialBandsAndSummaryRevision"));
            Assert.True(current > 0);
            var migrator = db.GetService<Microsoft.EntityFrameworkCore.Migrations.IMigrator>();
            await migrator.MigrateAsync(migrations[current - 1]);
            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO performance."PerformanceCycles" ("Id", "Name", "StartDate", "EndDate", "PlanningDeadline", "State", "CreatedAt", "TenantId")
                VALUES ({0}, 'FY27', '2026-10-01', '2027-09-30', '2026-11-01', 'Active', now(), {1});
                INSERT INTO performance."RatingScales" ("Id", "CurrentVersionNumber", "CreatedAt", "TenantId") VALUES ({2}, 1, now(), {1});
                INSERT INTO performance."RatingScaleVersions" ("Id", "RatingScaleId", "Number", "Levels", "CreatedAt", "TenantId")
                VALUES ({3}, {2}, 1, '[{{"Value":1,"Label":"a"}},{{"Value":2,"Label":"b"}},{{"Value":3,"Label":"c"}},{{"Value":4,"Label":"d"}},{{"Value":5,"Label":"e"}}]', now(), {1});
                INSERT INTO performance."ReviewRounds" ("Id", "CycleId", "Name", "PeriodStart", "PeriodEnd", "SelfAssessmentEnabled",
                    "ObjectiveRatingsEnabled", "CalibrationEnabled", "PotentialEnabled", "ManagerAssessmentDueDate", "CompetencyIdsJson",
                    "State", "CreatedAt", "TenantId", "RatingScaleVersionId")
                VALUES ({4}, {0}, 'Year-end', '2026-10-01', '2027-08-31', false, false, true, true, '2027-09-22', '[]',
                    'Active', now(), {1}, {3});
                INSERT INTO performance."PerformanceReviews" ("Id", "ReviewRoundId", "CycleId", "SubjectEmployeeId", "SubjectDisplayName",
                    "ReviewerEmployeeId", "ReviewerDisplayName", "RatingScaleVersionId", "RatingScaleSnapshotJson", "State", "OpenedAt",
                    "CreatedAt", "TenantId", "ReviewerBasis", "SelfAssessmentEnabled", "ObjectiveRatingsEnabled", "CalibrationEnabled",
                    "PotentialEnabled", "Potential", "ManagerAssessmentSummary", "ManagerAssessmentOverallRating", "ManagerAssessmentSubmittedAt",
                    "FinalRating", "FinalRatingSource")
                VALUES ({5}, {4}, {0}, gen_random_uuid(), 'Tarek', gen_random_uuid(), 'Mariam', {3}, '[]',
                    'ReadyToFinalize', now(), now(), {1}, 'CoreManagerAtCycleStart', false, false, true,
                    true, 'High', 'Went beyond the role.', 4, now(), 3, 'Calibration');
                INSERT INTO performance."CalibrationSessions" ("Id", "ReviewRoundId", "CycleId", "State", "OpenedByUserId", "OpenedAt",
                    "FinalizedAt", "CreatedAt", "TenantId")
                VALUES ({6}, {4}, {0}, 'Finalized', gen_random_uuid(), now(), now(), now(), {1});
                INSERT INTO performance."CalibrationSubjects" ("Id", "SessionId", "ReviewId", "OriginalRating", "CalibratedRating", "Rationale",
                    "DiscussionState", "CreatedAt", "TenantId")
                VALUES ({7}, {6}, {5}, 4, 3, 'Once only.', 'Discussed', now(), {1});
                """, cycleId, tenantId, scaleId, versionId, roundId, reviewId, sessionId, subjectId);

            await migrator.MigrateAsync();
            db.ChangeTracker.Clear();
            var session = await db.CalibrationSessions.AsNoTracking().SingleAsync(item => item.Id == sessionId);
            Assert.Equal(new NineBoxBands(2, 3), session.Bands);
            var subject = await db.CalibrationSubjects.AsNoTracking().SingleAsync(item => item.Id == subjectId);
            Assert.Equal((ReviewPotential.High, (ReviewPotential?)null), (subject.OriginalPotential, subject.CalibratedPotential));
            var review = await db.PerformanceReviews.AsNoTracking().SingleAsync(item => item.Id == reviewId);
            Assert.Equal((ReviewPotential.High, true), (review.FinalPotential, review.CalibrationChangedRating));
            Assert.Null(review.SummaryRevisedAt);
            Assert.Empty(await db.CycleSettings.AsNoTracking().ToListAsync());

            await migrator.MigrateAsync(migrations[current - 1]);
            Assert.Equal(0, await NewColumnsAsync(db));
            await migrator.MigrateAsync();
            Assert.Equal(13, await NewColumnsAsync(db));
        }
        finally { await RelationalTests.DropDatabaseAsync(baseConnection, databaseName); }
    }

    private static Task<int> NewColumnsAsync(EY.HRPlatform.Performance.Infrastructure.Persistence.PerformanceDbContext db)
        => db.Database.SqlQueryRaw<int>("""
            SELECT count(*)::int AS "Value" FROM information_schema.columns
            WHERE table_schema='performance' AND column_name IN ('CalibrationChangedRating','FinalPotential','SummaryCheckedAt',
                'SummaryRevisedAt','SummaryRevisedByEmployeeId','NineBoxLowTop','NineBoxMidTop','CalibratedPotential','OriginalPotential',
                'BandLowTop','BandMidTop','NewPotential','PreviousPotential')
            """).SingleAsync();
}
