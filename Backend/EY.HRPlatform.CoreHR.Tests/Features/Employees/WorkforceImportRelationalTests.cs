using System.Text;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Employees.Import;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Features.People;
using EY.HRPlatform.CoreHR.Features.Setup;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.Features.Organization;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

/// <summary>
/// PostgreSQL-backed coverage for what InMemory cannot exercise: xmin/ETag concurrency, the
/// publication transaction and advisory lock, fingerprint guards, idempotent replay, cohort and
/// readiness queries, and the lifecycle migration. Set FUSION_COREHR_RELATIONAL_TEST_CONNECTION to run.
/// </summary>
public sealed class WorkforceImportRelationalTests
{
    private static readonly ImportActor Actor = new(Guid.NewGuid(), "Amina");
    private const string PreviousMigration = "20260924100307_SemanticConsentScope";

    private const string CleanCsv = "Employee Number,First Name,Last Name,Employment Start,Organization,Title,Manager\n"
        + "E-201,Amina,Mansour,2021-02-01,OPS,Consultant,E-200\n" // reports to someone later in the file
        + "E-200,Youssef,BenAli,2019-01-01,OPS,Director,\n";

    [RelationalDatabaseFact]
    public async Task Clean_create_only_import_publishes_atomically_and_replays_idempotently()
    {
        await WithDatabaseAsync(async (cs, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            await SeedOrganization(cs, tenantId, today);
            var session = await Intake(cs, tenantId, CleanCsv, today);
            Assert.True(session.MatchComplete);
            Assert.True(session.CanPublish);
            Assert.Equal(2, session.CreateCount);

            await PublishAndProcess(cs, tenantId, session.Id);

            await using var db = CreateDb(cs, tenantId);
            Assert.Equal(2, await db.Employees.CountAsync());
            Assert.Equal(2, await db.Employments.CountAsync(e => e.EffectiveTo == null && e.ImportBatchId == session.Id));
            Assert.Equal(1, await db.ManagerRelationships.CountAsync(m => m.EffectiveTo == null && m.ImportBatchId == session.Id));
            var committed = await db.WorkforceImportSessions.Include(s => s.Source).Include(s => s.Rows).SingleAsync(s => s.Id == session.Id);
            Assert.Equal(WorkforceImportStatus.Committed, committed.Status);
            Assert.Equal(session.ProposalFingerprint, committed.FinalProposalFingerprint);
            Assert.NotNull(committed.CommitResultJson);
            Assert.Contains("sourceSha256", committed.FinalProvenanceJson);
            Assert.Null(committed.Source.RawBytes);
            Assert.All(committed.Rows, r => Assert.Null(r.SourceCellsJson));

            // Replay: the stored result, no second write.
            var replay = await WorkforceImportTestKit.Orchestrator(db, tenantId).ExecuteAsync(session.Id, session.ProposalFingerprint!, Actor, null, default);
            Assert.True(replay.AlreadyApplied);
            var status = await WorkforceImportTestKit.Publication(db, tenantId).PublishAsync(session.Id, committed.Version, session.ProposalFingerprint, Actor, default);
            Assert.Equal("Succeeded", status.Status);
            Assert.Equal(2, await db.Employees.CountAsync());
        });
    }

    [RelationalDatabaseFact]
    public async Task Publish_is_refused_for_a_stale_fingerprint_and_for_blockers()
    {
        await WithDatabaseAsync(async (cs, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            await SeedOrganization(cs, tenantId, today);
            var session = await Intake(cs, tenantId, CleanCsv, today);

            await using (var db = CreateDb(cs, tenantId))
            {
                var ex = await Assert.ThrowsAsync<WorkforceImportReviewException>(() =>
                    WorkforceImportTestKit.Publication(db, tenantId).PublishAsync(session.Id, session.Version, "not-what-was-reviewed", Actor, default));
                Assert.Equal("ProposalChanged", ex.Code);
            }

            var blocked = await Intake(cs, tenantId, CleanCsv.Replace("OPS,Director", "Mystery,Director"), today);
            Assert.False(blocked.CanPublish);
            await using (var db = CreateDb(cs, tenantId))
            {
                var ex = await Assert.ThrowsAsync<WorkforceImportReviewException>(() =>
                    WorkforceImportTestKit.Publication(db, tenantId).PublishAsync(blocked.Id, blocked.Version, blocked.ProposalFingerprint, Actor, default));
                Assert.Equal("NotPublishable", ex.Code);
                Assert.Equal(0, await db.Employees.CountAsync());
            }
        });
    }

    [RelationalDatabaseFact]
    public async Task Worker_refuses_a_proposal_that_changed_after_confirmation_and_writes_nothing()
    {
        await WithDatabaseAsync(async (cs, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var opsId = await SeedOrganization(cs, tenantId, today);
            var session = await Intake(cs, tenantId, CleanCsv, today);
            await Confirm(cs, tenantId, session);

            // After confirmation, the referenced unit is inactivated: the derived proposal changes.
            await using (var db = CreateDb(cs, tenantId))
            {
                var org = new OrganizationService(db, TestTenantContext.WithTenant(tenantId));
                var unit = await org.GetUnitAsync(opsId, today, default);
                await org.InactivateAsync(opsId, unit.Version, new InactivateOrganizationUnitRequest(today, "Inactivate"), default);
            }
            await ProcessUntilTerminal(cs, tenantId, session.Id);

            await using var verify = CreateDb(cs, tenantId);
            var op = await verify.WorkforceImportApplyOperations.SingleAsync(o => o.SessionId == session.Id);
            Assert.Equal(WorkforceImportApplyStatus.ReviewOutdated, op.Status);
            Assert.Equal(0, await verify.Employees.CountAsync());
            var after = await verify.WorkforceImportSessions.SingleAsync(s => s.Id == session.Id);
            Assert.Equal(WorkforceImportStatus.Active, after.Status);
            Assert.False(after.IsPublishing); // back to Review, unchanged
        });
    }

    [RelationalDatabaseFact]
    public async Task Two_attempts_for_the_same_people_cannot_both_create_them()
    {
        await WithDatabaseAsync(async (cs, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            await SeedOrganization(cs, tenantId, today);
            var first = await Intake(cs, tenantId, CleanCsv, today);
            var second = await Intake(cs, tenantId, CleanCsv, today);
            await Confirm(cs, tenantId, first);
            await Confirm(cs, tenantId, second);

            await ProcessUntilTerminal(cs, tenantId, first.Id);
            await ProcessUntilTerminal(cs, tenantId, second.Id);

            await using var db = CreateDb(cs, tenantId);
            Assert.Equal(2, await db.Employees.CountAsync()); // never duplicated
            Assert.Equal(WorkforceImportApplyStatus.ReviewOutdated,
                (await db.WorkforceImportApplyOperations.SingleAsync(o => o.SessionId == second.Id)).Status);
        });
    }

    [RelationalDatabaseFact]
    public async Task Stale_etag_match_change_conflicts_and_concurrent_changes_have_one_winner()
    {
        await WithDatabaseAsync(async (cs, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            await SeedOrganization(cs, tenantId, today);
            var session = await Intake(cs, tenantId, CleanCsv, today);

            async Task<bool> TryChange(WorkforceDateFormat format)
            {
                await using var db = CreateDb(cs, tenantId);
                try
                {
                    await WorkforceImportTestKit.Review(db, tenantId).UpdateMatchAsync(session.Id, session.Version,
                        new WorkforceMatchUpdateRequest(DateFormat: format), Actor, default);
                    return true;
                }
                catch (WorkforceImportConcurrencyException) { return false; }
            }

            var results = await Task.WhenAll(TryChange(WorkforceDateFormat.DayMonthYear), TryChange(WorkforceDateFormat.MonthDayYear));
            Assert.Equal(1, results.Count(ok => ok));
            Assert.False(await TryChange(WorkforceDateFormat.Iso)); // the original ETag is now stale
        });
    }

    [RelationalDatabaseFact]
    public async Task Resolutions_are_issue_gated_and_one_answers_every_row_using_the_value()
    {
        const string csv = "Employee Number,First Name,Last Name,Employment Start,Organization,Title\n"
            + "E-100,Amina,Mansour,2021-02-01,OPS,Consultant\n"
            + "E-101,Youssef,BenAli,2020-01-01,Mystery,Analyst\n"
            + "E-102,Leila,Haddad,2019-03-01,Mystery,Lead\n";
        await WithDatabaseAsync(async (cs, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var opsId = await SeedOrganization(cs, tenantId, today);
            var session = await Intake(cs, tenantId, csv, today);
            Assert.Equal(2, session.BlockedCount);

            await using (var db = CreateDb(cs, tenantId))
            {
                var review = WorkforceImportTestKit.Review(db, tenantId);
                var rejected = await Assert.ThrowsAsync<WorkforceImportReviewException>(() => review.UpdateResolutionsAsync(session.Id, session.Version,
                    new WorkforceResolutionsUpdateRequest(OrganizationSourceValue: "OPS", OrganizationUnitId: opsId), Actor, default));
                Assert.Equal("ResolutionNotNeeded", rejected.Code);
            }

            await using (var db = CreateDb(cs, tenantId))
            {
                var summary = await WorkforceImportTestKit.Review(db, tenantId).UpdateResolutionsAsync(session.Id, session.Version,
                    new WorkforceResolutionsUpdateRequest(OrganizationSourceValue: "Mystery", OrganizationUnitId: opsId), Actor, default);
                Assert.Equal(3, summary.Counts.Create);
                Assert.Equal(0, summary.Counts.Blocked);
                Assert.True(summary.CanPublish);
            }

            // A Match change re-derives the proposal and its fingerprint.
            await using (var db = CreateDb(cs, tenantId))
            {
                var before = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == session.Id);
                var changed = await WorkforceImportTestKit.Review(db, tenantId).UpdateMatchAsync(session.Id, before.Version,
                    new WorkforceMatchUpdateRequest(ColumnMappings: new() { [5] = WorkforceImportField.Ignored }), Actor, default);
                Assert.NotEqual(before.ProposalFingerprint, changed.ProposalFingerprint);
                Assert.False(changed.MatchComplete); // Title is required
            }
        });
    }

    [RelationalDatabaseFact]
    public async Task Changing_the_as_of_date_drops_resolutions_that_no_longer_hold_and_refuses_the_future()
    {
        const string csv = "Employee Number,First Name,Last Name,Employment Start,Organization,Title\n"
            + "E-100,Amina,Mansour,2021-02-01,OPS,Consultant\n"
            + "E-101,Youssef,BenAli,2020-01-01,Mystery,Analyst\n";
        await WithDatabaseAsync(async (cs, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var opsId = await SeedOrganization(cs, tenantId, today);
            var session = await Intake(cs, tenantId, csv, today);
            await using (var db = CreateDb(cs, tenantId))
                await WorkforceImportTestKit.Review(db, tenantId).UpdateResolutionsAsync(session.Id, session.Version,
                    new WorkforceResolutionsUpdateRequest(OrganizationSourceValue: "Mystery", OrganizationUnitId: opsId), Actor, default);

            await using (var db = CreateDb(cs, tenantId))
            {
                var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == session.Id);
                var refused = await Assert.ThrowsAsync<WorkforceImportReviewException>(() => WorkforceImportTestKit.Review(db, tenantId)
                    .ChangeBaselineDateAsync(session.Id, current.Version, today.AddDays(1), Actor, default));
                Assert.Equal("BaselineNotAllowed", refused.Code);
            }

            // The chosen unit doesn't exist yet on the earlier date, so that answer no longer holds.
            await using (var db = CreateDb(cs, tenantId))
            {
                var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == session.Id);
                var changed = await WorkforceImportTestKit.Review(db, tenantId)
                    .ChangeBaselineDateAsync(session.Id, current.Version, today.AddDays(-1), Actor, default);
                Assert.True(WorkforceImportResolutions.Parse(changed.ResolutionsJson).IsEmpty);
                Assert.NotEqual(current.ProposalFingerprint, changed.ProposalFingerprint);
                Assert.Equal(2, changed.BlockedCount);
            }
        });
    }

    [RelationalDatabaseFact]
    public async Task Review_is_paged_filtered_and_searchable_server_side()
    {
        await WithDatabaseAsync(async (cs, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            await SeedOrganization(cs, tenantId, today);
            var session = await Intake(cs, tenantId, CleanCsv + "E-202,Leila,Haddad,2019-01-01,OPS,Analyst,\n", today);

            await using var db = CreateDb(cs, tenantId);
            var review = WorkforceImportTestKit.Review(db, tenantId);
            var search = await review.GetReviewPageAsync(session.Id, null, "youssef", 1, 20, default);
            Assert.Equal("Youssef BenAli", Assert.Single(search.Rows).Employee.DisplayName);
            Assert.Equal("Operations", search.Rows[0].Work.Organization); // the canonical unit, not the file's text
            var created = await review.GetReviewPageAsync(session.Id, "Create", null, 1, 2, default);
            Assert.Equal(3, created.TotalMatching);
            Assert.Equal(2, created.Rows.Count);
        });
    }

    [RelationalDatabaseFact]
    public async Task People_cohort_and_coreHR_readiness_come_from_canonical_truth()
    {
        await WithDatabaseAsync(async (cs, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            await SeedOrganization(cs, tenantId, today);

            await using (var db = CreateDb(cs, tenantId))
            {
                var readiness = await Readiness(db, tenantId).GetAsync(default);
                Assert.False(readiness.IsReady);
                Assert.Equal(0, readiness.Workforce.ActiveEmployees);
            }

            var session = await Intake(cs, tenantId, CleanCsv, today);
            await PublishAndProcess(cs, tenantId, session.Id);

            await using (var db = CreateDb(cs, tenantId))
            {
                var readiness = await Readiness(db, tenantId).GetAsync(default);
                Assert.True(readiness.IsReady);
                Assert.Equal(2, readiness.Workforce.ActiveEmployees);
                Assert.Equal(0, readiness.Workforce.WithoutCurrentAssignment);
                Assert.False(readiness.Workforce.ImportInProgress);

                var keys = await db.Employments.Where(e => e.ImportBatchId == session.Id)
                    .Join(db.Employees, e => e.EmployeeId, emp => emp.Id, (_, emp) => emp.StableEmployeeKey).ToListAsync();
                Assert.Equal(2, keys.Distinct().Count());
            }
        });
    }

    [RelationalDatabaseFact]
    public async Task Lifecycle_migration_converts_faithful_attempts_purges_unfaithful_and_folds_history()
    {
        await WithDatabaseAsync(async (cs, tenantId) =>
        {
            var faithful = Guid.NewGuid();
            var unfaithful = Guid.NewGuid();
            var committed = Guid.NewGuid();
            var otherTenant = Guid.NewGuid(); // the legacy schema allowed one active attempt per tenant
            var legacyDecisions = "{\"columnMappings\":{\"4\":\"Manager\"},\"dateFormat\":\"DayMonthYear\",\"organizationBySourceValue\":{\"mystery\":\"" + Guid.NewGuid() + "\"}}";
            await ExecuteAsync(cs, $$"""
                INSERT INTO corehr."WorkforceImportSessions"
                  ("Id","TenantId","Status","BaselineDate","CreationToken","CreationFingerprint","SelectedSheetName","StartedByUserId","StartedByDisplayName",
                   "LastUpdatedByUserId","LastUpdatedByDisplayName","DecisionsJson","DecisionRevision","NewCount","ExistingAnchorCount","NeedsAttentionCount",
                   "ExcludedCount","ExpiresAt","CreatedAt","CommitResultJson")
                VALUES
                  ('{{faithful}}','{{tenantId}}','Reviewing','2026-08-17','{{Guid.NewGuid()}}','fp1','Sheet1','{{Actor.UserId}}','A','{{Actor.UserId}}','A',
                   '{{legacyDecisions}}',2,3,0,0,0,now()+interval '7 days',now(),NULL),
                  ('{{unfaithful}}','{{otherTenant}}','Ready','2026-08-17','{{Guid.NewGuid()}}','fp2','Sheet1','{{Actor.UserId}}','A','{{Actor.UserId}}','A',
                   '{"excludedRows":[3]}',1,3,0,0,1,now()+interval '7 days',now(),NULL),
                  ('{{committed}}','{{tenantId}}','Committed','2026-08-17','{{Guid.NewGuid()}}','fp3','Sheet1','{{Actor.UserId}}','A','{{Actor.UserId}}','A',
                   '{}',0,2,0,0,0,now(),now(),NULL);
                INSERT INTO corehr."WorkforceImportRows" ("Id","SessionId","TenantId","SourceRowNumber","SourceCellsJson","Classification","IsExcluded","CreatedAt")
                VALUES ('{{Guid.NewGuid()}}','{{faithful}}','{{tenantId}}',1,'["a"]','NewEmployee',false,now()),
                       ('{{Guid.NewGuid()}}','{{unfaithful}}','{{otherTenant}}',1,'["b"]','Excluded',true,now());
                INSERT INTO corehr."WorkforceImportHistories" ("Id","TenantId","SessionId","BaselineDate","SourceFileName","Sha256","ActorUserId","ActorDisplayName",
                   "CommittedAt","AddedEmployeeCount","ExistingAnchorCount","ExcludedCount","CreatedEmployeeKeysJson","CreatedAt")
                VALUES ('{{Guid.NewGuid()}}','{{tenantId}}','{{committed}}','2026-08-17','wf.csv','sha','{{Actor.UserId}}','A',now(),2,0,0,'["K1","K2"]',now());
                """, migrateTo: PreviousMigration);

            await using (var migrate = CreateDb(cs, tenantId))
                await migrate.Database.MigrateAsync();

            await using var db = CreateDb(cs, tenantId);
            var converted = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == faithful);
            Assert.Equal(WorkforceImportStatus.Active, converted.Status);
            var plan = WorkforceImportMappingPlan.Parse(converted.MappingPlanJson);
            Assert.Equal(WorkforceImportField.Manager, plan.ColumnMappings[4]);
            Assert.Equal(ImportResolutionOrigin.Administrator, plan.ColumnOrigins[4]);
            Assert.Equal(WorkforceDateFormat.DayMonthYear, plan.DateFormat);
            Assert.Single(WorkforceImportResolutions.Parse(converted.ResolutionsJson).OrganizationBySourceValue);
            Assert.Null(converted.ProposalFingerprint); // re-derived on first open

            var purged = await db.WorkforceImportSessions.IgnoreQueryFilters().Include(s => s.Rows).AsNoTracking().SingleAsync(s => s.Id == unfaithful);
            Assert.Equal(WorkforceImportStatus.Discarded, purged.Status);
            Assert.All(purged.Rows, r => Assert.Null(r.SourceCellsJson));

            var history = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == committed);
            Assert.Equal(WorkforceImportStatus.Committed, history.Status);
            Assert.Contains("K1", history.CommitResultJson);
            Assert.Contains("wf.csv", history.FinalProvenanceJson);
        }, migrate: false);
    }

    [RelationalDatabaseFact]
    public async Task Lifecycle_migration_refuses_to_run_while_a_publication_is_in_flight()
    {
        await WithDatabaseAsync(async (cs, tenantId) =>
        {
            var session = Guid.NewGuid();
            await ExecuteAsync(cs, $$"""
                INSERT INTO corehr."WorkforceImportSessions"
                  ("Id","TenantId","Status","BaselineDate","CreationToken","CreationFingerprint","SelectedSheetName","StartedByUserId","StartedByDisplayName",
                   "LastUpdatedByUserId","LastUpdatedByDisplayName","DecisionsJson","DecisionRevision","NewCount","ExistingAnchorCount","NeedsAttentionCount",
                   "ExcludedCount","ExpiresAt","CreatedAt")
                VALUES ('{{session}}','{{tenantId}}','Applying','2026-08-17','{{Guid.NewGuid()}}','fp','Sheet1','{{Actor.UserId}}','A','{{Actor.UserId}}','A','{}',0,1,0,0,0,now(),now());
                INSERT INTO corehr."WorkforceImportApplyOperations" ("Id","TenantId","SessionId","Status","Phase","ProcessedCount","ActorUserId","ActorDisplayName","QueuedAt","CreatedAt")
                VALUES ('{{Guid.NewGuid()}}','{{tenantId}}','{{session}}','Running','Saving',0,'{{Actor.UserId}}','A',now(),now());
                """, migrateTo: PreviousMigration);

            await using var migrate = CreateDb(cs, tenantId);
            await Assert.ThrowsAnyAsync<PostgresException>(() => migrate.Database.MigrateAsync());
        }, migrate: false);
    }

    // ---- helpers ----

    private static CoreHRReadinessService Readiness(CoreHRDbContext db, Guid tenantId)
        => new(db, new OrganizationService(db, TestTenantContext.WithTenant(tenantId)));

    private static async Task<Guid> SeedOrganization(string cs, Guid tenantId, DateOnly today)
    {
        await using var db = CreateDb(cs, tenantId);
        var org = new OrganizationService(db, TestTenantContext.WithTenant(tenantId));
        await org.GetTypesAsync(default);
        var root = await org.CreateRootAsync(new CreateOrganizationRootRequest("LUMERA", "Lumera Group", today), default);
        var unit = await org.CreateUnitAsync(new CreateOrganizationUnitRequest("OPS", "Operations", OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default);
        return unit.Id;
    }

    private static async Task<WorkforceImportSession> Intake(string cs, Guid tenantId, string csv, DateOnly baseline)
    {
        Guid id;
        await using (var db = CreateDb(cs, tenantId))
            id = (await WorkforceImportTestKit.Sessions(db, tenantId).IntakeAsync(new WorkforceImportIntakeRequest(
                Guid.NewGuid(), baseline, new MemoryStream(Encoding.UTF8.GetBytes(csv)), "wf.csv", "text/csv", null, Actor), default)).Session!.Id;
        await using var read = CreateDb(cs, tenantId);
        return await read.WorkforceImportSessions.Include(s => s.Source).AsNoTracking().SingleAsync(s => s.Id == id);
    }

    /// <summary>Publish with the fingerprint the administrator reviewed.</summary>
    private static async Task Confirm(string cs, Guid tenantId, WorkforceImportSession session)
    {
        await using var db = CreateDb(cs, tenantId);
        var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == session.Id);
        var status = await WorkforceImportTestKit.Publication(db, tenantId).PublishAsync(session.Id, current.Version, current.ProposalFingerprint, Actor, default);
        Assert.Equal("Queued", status.Status);
    }

    private static async Task PublishAndProcess(string cs, Guid tenantId, Guid sessionId)
    {
        await using (var db = CreateDb(cs, tenantId))
        {
            var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == sessionId);
            await Confirm(cs, tenantId, current);
        }
        await ProcessUntilTerminal(cs, tenantId, sessionId);
        await using var verify = CreateDb(cs, tenantId);
        Assert.Equal(WorkforceImportApplyStatus.Succeeded, (await verify.WorkforceImportApplyOperations.SingleAsync(o => o.SessionId == sessionId)).Status);
    }

    private static async Task ProcessUntilTerminal(string cs, Guid tenantId, Guid sessionId)
    {
        var provider = new ServiceCollection()
            .AddScoped(_ => CreateDb(cs, tenantId))
            .AddScoped<EY.HRPlatform.SharedKernel.Multitenancy.TenantContext>()
            .AddScoped<EY.HRPlatform.SharedKernel.Multitenancy.ITenantContext>(sp => sp.GetRequiredService<EY.HRPlatform.SharedKernel.Multitenancy.TenantContext>())
            .AddScoped(sp => WorkforceImportTestKit.Orchestrator(sp.GetRequiredService<CoreHRDbContext>(), tenantId))
            .BuildServiceProvider();
        var processor = new WorkforceImportApplyProcessor(provider);
        for (var i = 0; i < 5; i++)
        {
            await processor.ProcessNextAsync(default);
            await using var db = CreateDb(cs, tenantId);
            var op = await db.WorkforceImportApplyOperations.SingleOrDefaultAsync(o => o.SessionId == sessionId);
            if (op is not null && op.IsTerminal) return;
        }
    }

    private static CoreHRDbContext CreateDb(string connectionString, Guid tenantId)
        => new(new DbContextOptionsBuilder<CoreHRDbContext>().UseNpgsql(connectionString).Options, TestTenantContext.WithTenant(tenantId));

    private static async Task ExecuteAsync(string cs, string sql, string migrateTo)
    {
        await using (var db = CreateDb(cs, Guid.Empty))
            await db.GetService<IMigrator>().MigrateAsync(migrateTo);
        await using var connection = new NpgsqlConnection(cs);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task WithDatabaseAsync(Func<string, Guid, Task> body, bool migrate = true)
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_COREHR_RELATIONAL_TEST_CONNECTION")!;
        var databaseName = $"fusion_corehr_wfi_{Guid.NewGuid():N}";
        var connectionString = new NpgsqlConnectionStringBuilder(baseConnection) { Database = databaseName, Pooling = false }.ConnectionString;
        try
        {
            await CreateDatabaseAsync(baseConnection, databaseName);
            var tenantId = Guid.NewGuid();
            if (migrate)
                await using (var migrated = CreateDb(connectionString, tenantId))
                    await migrated.Database.MigrateAsync();
            await body(connectionString, tenantId);
        }
        finally
        {
            await DropDatabaseAsync(baseConnection, databaseName);
        }
    }

    private static async Task CreateDatabaseAsync(string baseConnectionString, string databaseName)
    {
        var admin = new NpgsqlConnectionStringBuilder(baseConnectionString) { Database = "postgres", Pooling = false }.ConnectionString;
        await using var connection = new NpgsqlConnection(admin);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"CREATE DATABASE \"{databaseName}\"", connection);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task DropDatabaseAsync(string baseConnectionString, string databaseName)
    {
        if (string.IsNullOrWhiteSpace(baseConnectionString)) return;
        var admin = new NpgsqlConnectionStringBuilder(baseConnectionString) { Database = "postgres", Pooling = false }.ConnectionString;
        await using var connection = new NpgsqlConnection(admin);
        await connection.OpenAsync();
        await using (var terminate = new NpgsqlCommand(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = @databaseName AND pid <> pg_backend_pid();", connection))
        {
            terminate.Parameters.AddWithValue("databaseName", databaseName);
            await terminate.ExecuteNonQueryAsync();
        }
        await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{databaseName}\"", connection);
        await drop.ExecuteNonQueryAsync();
    }
}
