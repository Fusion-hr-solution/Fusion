using EY.HRPlatform.Performance.Domain.Reviews;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Npgsql;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>The peers, questions and release migration against PostgreSQL (opt-in, like <see cref="RelationalTests"/>).</summary>
public sealed class ReviewSliceFourRelationalTests
{
    [RelationalDatabaseFact]
    public async Task Existing_rounds_read_with_new_components_off_and_the_migration_rolls_back()
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_PERFORMANCE_RELATIONAL_TEST_CONNECTION")!;
        var databaseName = $"fusion_perf_{Guid.NewGuid():N}";
        var connection = new NpgsqlConnectionStringBuilder(baseConnection) { Database = databaseName, Pooling = false }.ConnectionString;
        var tenantId = Guid.NewGuid();
        var cycleId = Guid.NewGuid();
        var roundId = Guid.NewGuid();
        var reviewId = Guid.NewGuid();
        var scaleId = Guid.NewGuid();
        var versionId = Guid.NewGuid();
        try
        {
            await RelationalTests.CreateDatabaseAsync(baseConnection, databaseName);
            await using var db = RelationalTests.CreateDb(connection, tenantId);
            var migrations = db.Database.GetMigrations().ToArray();
            var current = Array.FindIndex(migrations, m => m.EndsWith("_AddReviewPeersQuestionsAndRelease"));
            Assert.True(current > 0);
            var migrator = db.GetService<Microsoft.EntityFrameworkCore.Migrations.IMigrator>();
            await migrator.MigrateAsync(migrations[current - 1]);
            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO performance."PerformanceCycles" ("Id", "Name", "StartDate", "EndDate", "PlanningDeadline", "State", "CreatedAt", "TenantId")
                VALUES ({0}, 'FY26', '2026-01-01', '2026-12-31', '2026-02-01', 'Active', now(), {1});
                INSERT INTO performance."RatingScales" ("Id", "CurrentVersionNumber", "CreatedAt", "TenantId") VALUES ({2}, 1, now(), {1});
                INSERT INTO performance."RatingScaleVersions" ("Id", "RatingScaleId", "Number", "Levels", "CreatedAt", "TenantId")
                VALUES ({3}, {2}, 1, '[{{"Value":3,"Label":"Meets"}}]', now(), {1});
                INSERT INTO performance."ReviewRounds" ("Id", "CycleId", "Name", "PeriodStart", "PeriodEnd", "SelfAssessmentEnabled",
                    "ObjectiveRatingsEnabled", "CalibrationEnabled", "SelfAssessmentDueDate", "ManagerAssessmentDueDate", "CompetencyIdsJson",
                    "State", "CreatedAt", "TenantId", "RatingScaleVersionId")
                VALUES ({4}, {0}, 'Mid-year', '2026-01-01', '2026-06-30', true, true, false, '2026-07-15', '2026-07-22', '[]',
                    'Active', now(), {1}, {3});
                INSERT INTO performance."PerformanceReviews" ("Id", "ReviewRoundId", "CycleId", "SubjectEmployeeId", "SubjectDisplayName",
                    "ReviewerEmployeeId", "ReviewerDisplayName", "RatingScaleVersionId", "RatingScaleSnapshotJson", "State", "OpenedAt",
                    "CreatedAt", "TenantId", "ReviewerBasis", "SelfAssessmentEnabled", "ObjectiveRatingsEnabled", "CalibrationEnabled",
                    "CurrentStageDueDate", "ManagerAssessmentDueDate")
                VALUES ({5}, {4}, {0}, gen_random_uuid(), 'Aicha', gen_random_uuid(), 'Mariam', {3}, '[{{"Value":3,"Label":"Meets"}}]',
                    'SelfAssessment', now(), now(), {1}, 'CoreManagerAtCycleStart', true, true, false, '2026-07-15', '2026-07-22');
                """, cycleId, tenantId, scaleId, versionId, roundId, reviewId);

            // Up through this slice's migration and every later one, so the current model can read the rows.
            await migrator.MigrateAsync();
            db.ChangeTracker.Clear();
            var round = await db.ReviewRounds.AsNoTracking().SingleAsync(r => r.Id == roundId);
            Assert.False(round.PeerInputEnabled);
            Assert.False(round.QuestionsEnabled);
            Assert.False(round.PotentialEnabled);
            Assert.Null(round.PeerInputDueDate);
            Assert.Equal((14, 14, 7, 7), (round.SelfAssessmentDueDays, round.PeerInputDueDays, round.ManagerAssessmentDueDays, round.AcknowledgementReminderDays));
            var review = await db.PerformanceReviews.AsNoTracking().SingleAsync(r => r.Id == reviewId);
            Assert.Equal(new DateOnly(2026, 7, 15), review.SelfAssessmentDueDate);
            Assert.False(review.PeerInputEnabled || review.PotentialEnabled || review.SelfDueOverridden || review.ManagerDueOverridden);
            Assert.Null(review.Potential);
            Assert.Null(review.AcknowledgedAt);
            var settings = await db.CycleSettings.AsNoTracking().ToListAsync();
            Assert.Empty(settings);
            Assert.Equal(8, await CountTablesAsync(db));

            await migrator.MigrateAsync(migrations[current - 1]);
            Assert.Equal(0, await CountTablesAsync(db));
            await migrator.MigrateAsync();
            Assert.Equal(8, await CountTablesAsync(db));
        }
        finally { await RelationalTests.DropDatabaseAsync(baseConnection, databaseName); }
    }

    private static Task<int> CountTablesAsync(EY.HRPlatform.Performance.Infrastructure.Persistence.PerformanceDbContext db)
        => db.Database.SqlQueryRaw<int>("""
            SELECT count(*)::int AS "Value" FROM information_schema.tables
            WHERE table_schema='performance' AND table_name IN ('ReviewQuestions','ReviewRoundQuestions','ReviewQuestionSnapshots',
                'ReviewQuestionAnswers','PeerNominations','PeerRequests','PeerAnswers','ReviewDueDateMoves')
            """).SingleAsync();
}
