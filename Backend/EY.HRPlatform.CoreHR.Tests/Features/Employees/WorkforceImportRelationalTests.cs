using System.Text;
using EY.HRPlatform.CoreHR.Features.Employees.Import;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.Features.Organization;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

/// <summary>
/// PostgreSQL-backed coverage for behaviors the InMemory provider cannot exercise:
/// real xmin/ETag optimistic concurrency, concurrent-mutation conflict, the active-session
/// partial unique index, (TenantId, CreationToken) idempotency uniqueness, and source/row
/// cascade — all on a freshly migrated disposable database. Set
/// FUSION_COREHR_RELATIONAL_TEST_CONNECTION to run.
/// </summary>
public sealed class WorkforceImportRelationalTests
{
    private static readonly WorkforceImportActor Actor = new(Guid.NewGuid(), "Amina");
    private const string Csv = "Employee Number,First Name,Last Name\n001,Amina,Mansour\n002,Youssef,Ben Ali\n";

    [RelationalDatabaseFact]
    public async Task Migration_applies_and_session_source_rows_persist()
    {
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            Guid sessionId;
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var outcome = await NewService(db, tenantId).IntakeAsync(IntakeRequest(Guid.NewGuid()), default);
                Assert.Equal(WorkforceImportIntakeKind.Ready, outcome.Kind);
                sessionId = outcome.Session!.Id;
            }

            await using (var verify = CreateDb(connectionString, tenantId))
            {
                var session = await verify.WorkforceImportSessions
                    .Include(s => s.Source).Include(s => s.Rows)
                    .SingleAsync(s => s.Id == sessionId);
                Assert.Equal(WorkforceImportStatus.Intake, session.Status);
                Assert.NotNull(session.Source.RawBytes);
                Assert.Equal(2, session.Rows.Count);
                Assert.True(session.Version > 0); // real xmin populated by PostgreSQL
            }
        });
    }

    [RelationalDatabaseFact]
    public async Task Stale_etag_decision_update_conflicts()
    {
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            Guid sessionId;
            uint staleVersion;
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var session = (await NewService(db, tenantId).IntakeAsync(IntakeRequest(Guid.NewGuid()), default)).Session!;
                sessionId = session.Id;
                staleVersion = session.Version;
            }

            // First update with the current version succeeds and advances xmin.
            await using (var db = CreateDb(connectionString, tenantId))
                await NewService(db, tenantId).ReplaceDecisionsAsync(sessionId, "{\"dateFormat\":\"DD/MM/YYYY\"}", staleVersion, Actor, default);

            // A second update carrying the now-stale ETag must conflict, not silently overwrite.
            await using (var db = CreateDb(connectionString, tenantId))
                await Assert.ThrowsAsync<WorkforceImportConcurrencyException>(() =>
                    NewService(db, tenantId).ReplaceDecisionsAsync(sessionId, "{\"dateFormat\":\"MM/DD/YYYY\"}", staleVersion, Actor, default));
        });
    }

    [RelationalDatabaseFact]
    public async Task Concurrent_decision_updates_one_wins_one_conflicts()
    {
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            Guid sessionId;
            uint version;
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var session = (await NewService(db, tenantId).IntakeAsync(IntakeRequest(Guid.NewGuid()), default)).Session!;
                sessionId = session.Id;
                version = session.Version;
            }

            async Task<bool> TryUpdate(string value)
            {
                await using var db = CreateDb(connectionString, tenantId);
                try
                {
                    await NewService(db, tenantId).ReplaceDecisionsAsync(sessionId, value, version, Actor, default);
                    return true;
                }
                catch (WorkforceImportConcurrencyException)
                {
                    return false;
                }
            }

            var results = await Task.WhenAll(TryUpdate("{\"a\":1}"), TryUpdate("{\"b\":2}"));
            Assert.Equal(1, results.Count(success => success));
            Assert.Equal(1, results.Count(success => !success));
        });
    }

    [RelationalDatabaseFact]
    public async Task Active_singleton_index_blocks_second_active_session_but_terminal_does_not()
    {
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            await using var db = CreateDb(connectionString, tenantId);
            db.WorkforceImportSessions.Add(NewSession(tenantId));
            await db.SaveChangesAsync();

            db.WorkforceImportSessions.Add(NewSession(tenantId));
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
            db.ChangeTracker.Clear();

            // Discard the active one; a discarded (terminal) session no longer blocks a new active session.
            var active = await db.WorkforceImportSessions.SingleAsync(s => s.Status == WorkforceImportStatus.Intake);
            active.Discard(Actor);
            await db.SaveChangesAsync();

            db.WorkforceImportSessions.Add(NewSession(tenantId));
            await db.SaveChangesAsync(); // succeeds now
            Assert.Equal(1, await db.WorkforceImportSessions.CountAsync(s => s.Status == WorkforceImportStatus.Intake));
        });
    }

    [RelationalDatabaseFact]
    public async Task Creation_token_is_unique_per_tenant_across_status()
    {
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            await using var db = CreateDb(connectionString, tenantId);
            var token = Guid.NewGuid();
            var first = NewSession(tenantId, token);
            db.WorkforceImportSessions.Add(first);
            await db.SaveChangesAsync();
            first.Discard(Actor); // terminal — frees the active-singleton index but not the token index
            await db.SaveChangesAsync();

            db.WorkforceImportSessions.Add(NewSession(tenantId, token));
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        });
    }

    [RelationalDatabaseFact]
    public async Task Header_clarification_round_trip_reinterprets_same_source_without_reupload()
    {
        const string ambiguousCsv = "Employee Number,First Name,Department\nMatricule,Prénom,Département\n001,Amina,Ops\n";
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            Guid sessionId;
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var intake = await NewService(db, tenantId).IntakeAsync(
                    new WorkforceImportIntakeRequest(Guid.NewGuid(), new DateOnly(2026, 8, 17),
                        new MemoryStream(Encoding.UTF8.GetBytes(ambiguousCsv)), "people.csv", "text/csv", null, Actor),
                    default);
                Assert.Equal(WorkforceImportIntakeKind.HeaderClarificationRequired, intake.Kind);
                Assert.True(intake.HeaderCandidates!.Count > 1);
                sessionId = intake.Session!.Id;
            }

            await using (var db = CreateDb(connectionString, tenantId))
            {
                // A client reads the current ETag before selecting the header row.
                var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == sessionId);
                await NewService(db, tenantId).SelectHeaderRowAsync(sessionId, 1, current.Version, Actor, default);
            }

            await using (var db = CreateDb(connectionString, tenantId))
            {
                var session = await db.WorkforceImportSessions.Include(s => s.Source).Include(s => s.Rows).AsNoTracking().SingleAsync(s => s.Id == sessionId);
                Assert.Equal(WorkforceImportStatus.Interpreting, session.Status);
                Assert.Single(session.Rows); // header row consumed; one data row remains
                Assert.Contains("Matricule", session.Source.ColumnsJson);
            }
        });
    }

    [RelationalDatabaseFact]
    public async Task Deleting_session_cascades_source_and_rows()
    {
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            Guid sessionId;
            await using (var db = CreateDb(connectionString, tenantId))
                sessionId = (await NewService(db, tenantId).IntakeAsync(IntakeRequest(Guid.NewGuid()), default)).Session!.Id;

            await using (var db = CreateDb(connectionString, tenantId))
            {
                var session = await db.WorkforceImportSessions.Include(s => s.Source).Include(s => s.Rows).SingleAsync(s => s.Id == sessionId);
                db.WorkforceImportSessions.Remove(session);
                await db.SaveChangesAsync();
            }

            await using (var db = CreateDb(connectionString, tenantId))
            {
                Assert.Empty(await db.WorkforceImportSources.IgnoreQueryFilters().Where(s => s.SessionId == sessionId).ToListAsync());
                Assert.Empty(await db.WorkforceImportRows.IgnoreQueryFilters().Where(r => r.SessionId == sessionId).ToListAsync());
            }
        });
    }

    [RelationalDatabaseFact]
    public async Task Review_composition_grouped_decision_updates_all_affected_rows_and_counts()
    {
        const string csv = "Employee Number,First Name,Last Name,Employment Start,Organization,Title\n"
            + "E-100,Amina,Mansour,2021-02-01,OPS,Consultant\n"
            + "E-101,Youssef,BenAli,2020-01-01,Mystery,Analyst\n"
            + "E-102,Leila,Haddad,2019-03-01,Mystery,Lead\n";
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            Guid opsUnitId;
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var org = new EY.HRPlatform.CoreHR.Features.Organization.OrganizationService(db, TestTenantContext.WithTenant(tenantId));
                await org.GetTypesAsync(default);
                var root = await org.CreateRootAsync(new EY.HRPlatform.CoreHR.Features.Organization.CreateOrganizationRootRequest("ASTERIA", "Asteria", today), default);
                var unit = await org.CreateUnitAsync(new EY.HRPlatform.CoreHR.Features.Organization.CreateOrganizationUnitRequest(
                    "OPS", "Operations", EY.HRPlatform.CoreHR.Domain.Entities.OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default);
                opsUnitId = unit.Id;
            }

            Guid sessionId;
            await using (var db = CreateDb(connectionString, tenantId))
                sessionId = (await NewService(db, tenantId).IntakeAsync(
                    new WorkforceImportIntakeRequest(Guid.NewGuid(), today, new MemoryStream(Encoding.UTF8.GetBytes(csv)), "wf.csv", "text/csv", null, Actor), default)).Session!.Id;

            // First recompute: OPS resolves (New), the two "Mystery" rows need attention.
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == sessionId);
                var summary = await Review(db, tenantId).RecomputeAndSaveAsync(sessionId, current.Version, Actor, default);
                Assert.Equal(1, summary.Counts.New);
                Assert.Equal(2, summary.Counts.NeedsAttention);
                Assert.False(summary.CanCommit);
                Assert.Equal(WorkforceReviewState.Reviewable, summary.State);
            }

            // Bounded filtered query returns exactly the two attention rows.
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var page = await Review(db, tenantId).GetReviewPageAsync(sessionId, "NeedsAttention", null, 1, 50, default);
                Assert.Equal(2, page.TotalMatching);
                Assert.All(page.Rows, r => Assert.Equal("NeedsAttention", r.Result));
            }

            // ONE grouped Organization decision resolves BOTH "Mystery" rows.
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == sessionId);
                var summary = await Review(db, tenantId).ApplyDecisionAsync(sessionId, current.Version,
                    doc => doc.OrganizationBySourceValue["mystery"] = opsUnitId, Actor, default);
                Assert.Equal(3, summary.Counts.New);
                Assert.Equal(0, summary.Counts.NeedsAttention);
                Assert.True(summary.CanCommit);
            }
        });
    }

    [RelationalDatabaseFact]
    public async Task Apply_establishes_canonical_workforce_atomically_with_import_provenance_and_is_idempotent()
    {
        // Amina reports to Youssef via same-import Employee Number; both are new.
        const string csv = "Employee Number,First Name,Last Name,Employment Start,Organization,Title,Manager\n"
            + "E-200,Youssef,BenAli,2019-01-01,OPS,Director,\n"
            + "E-201,Amina,Mansour,2021-02-01,OPS,Consultant,E-200\n";
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var org = new EY.HRPlatform.CoreHR.Features.Organization.OrganizationService(db, TestTenantContext.WithTenant(tenantId));
                await org.GetTypesAsync(default);
                var root = await org.CreateRootAsync(new EY.HRPlatform.CoreHR.Features.Organization.CreateOrganizationRootRequest("ASTERIA", "Asteria", today), default);
                await org.CreateUnitAsync(new EY.HRPlatform.CoreHR.Features.Organization.CreateOrganizationUnitRequest(
                    "OPS", "Operations", EY.HRPlatform.CoreHR.Domain.Entities.OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default);
            }

            Guid sessionId;
            await using (var db = CreateDb(connectionString, tenantId))
                sessionId = (await NewService(db, tenantId).IntakeAsync(
                    new WorkforceImportIntakeRequest(Guid.NewGuid(), today, new MemoryStream(Encoding.UTF8.GetBytes(csv)), "wf.csv", "text/csv", null, Actor), default)).Session!.Id;

            await using (var db = CreateDb(connectionString, tenantId))
            {
                var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == sessionId);
                var summary = await Review(db, tenantId).RecomputeAndSaveAsync(sessionId, current.Version, Actor, default);
                Assert.Equal(2, summary.Counts.New);
                Assert.True(summary.CanCommit);
            }

            // Apply (freeze then execute the atomic core, as the operation worker does).
            await FreezeAsync(connectionString, tenantId, sessionId);
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var result = await Apply(db, tenantId).ExecuteAsync(sessionId, Actor, null, default);
                Assert.False(result.AlreadyApplied);
                Assert.Equal(2, result.AddedEmployeeCount);
                Assert.Equal(1, result.ManagerRelationshipCount);
            }

            // Canonical truth + provenance + purge.
            await using (var db = CreateDb(connectionString, tenantId))
            {
                Assert.Equal(2, await db.Employees.CountAsync());
                Assert.Equal(2, await db.Employments.CountAsync(e => e.EffectiveTo == null));
                Assert.All(await db.WorkAssignments.ToListAsync(), a => Assert.Equal(EY.HRPlatform.CoreHR.Domain.Enums.WorkforceSourceType.Import, a.Source));
                Assert.Equal(1, await db.ManagerRelationships.CountAsync(m => m.EffectiveTo == null));
                var session = await db.WorkforceImportSessions.Include(s => s.Source).Include(s => s.Rows).SingleAsync(s => s.Id == sessionId);
                Assert.Equal(WorkforceImportStatus.Committed, session.Status);
                Assert.Null(session.Source.RawBytes); // temporary PII purged
                Assert.All(session.Rows, r => Assert.Null(r.SourceCellsJson));
                Assert.Equal(1, await db.WorkforceImportHistories.CountAsync(h => h.SessionId == sessionId)); // durable history survives
            }

            // Idempotent replay after a lost response: same result, no duplicate employees.
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var replay = await Apply(db, tenantId).ExecuteAsync(sessionId, Actor, null, default);
                Assert.True(replay.AlreadyApplied);
                Assert.Equal(2, await db.Employees.CountAsync());
            }
        });
    }

    [RelationalDatabaseFact]
    public async Task Apply_rolls_back_completely_when_a_row_still_needs_attention()
    {
        const string csv = "Employee Number,First Name,Last Name,Employment Start,Organization,Title\n"
            + "E-300,Amina,Mansour,2021-02-01,Mystery,Consultant\n"; // unresolved Organization
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var org = new EY.HRPlatform.CoreHR.Features.Organization.OrganizationService(db, TestTenantContext.WithTenant(tenantId));
                await org.GetTypesAsync(default);
                await org.CreateRootAsync(new EY.HRPlatform.CoreHR.Features.Organization.CreateOrganizationRootRequest("ASTERIA", "Asteria", today), default);
            }
            Guid sessionId;
            await using (var db = CreateDb(connectionString, tenantId))
                sessionId = (await NewService(db, tenantId).IntakeAsync(
                    new WorkforceImportIntakeRequest(Guid.NewGuid(), today, new MemoryStream(Encoding.UTF8.GetBytes(csv)), "wf.csv", "text/csv", null, Actor), default)).Session!.Id;
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == sessionId);
                await Review(db, tenantId).RecomputeAndSaveAsync(sessionId, current.Version, Actor, default);
            }
            await FreezeAsync(connectionString, tenantId, sessionId);
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var ex = await Assert.ThrowsAsync<WorkforceImportApplyException>(() => Apply(db, tenantId).ExecuteAsync(sessionId, Actor, null, default));
                Assert.Equal(WorkforceImportApplyFailureKind.Blocked, ex.Kind);
            }
            await using (var db = CreateDb(connectionString, tenantId))
            {
                Assert.Equal(0, await db.Employees.CountAsync()); // nothing added
                var session = await db.WorkforceImportSessions.SingleAsync(s => s.Id == sessionId);
                Assert.NotEqual(WorkforceImportStatus.Committed, session.Status);
            }
        });
    }

    [RelationalDatabaseFact]
    public async Task Async_operation_completes_import_and_replays_idempotently()
    {
        const string csv = "Employee Number,First Name,Last Name,Employment Start,Organization,Title\n"
            + "E-400,Amina,Mansour,2021-02-01,OPS,Consultant\n";
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            await SeedOpsOrg(connectionString, tenantId, today);
            var sessionId = await IntakeAndReview(connectionString, tenantId, csv, today);

            // Complete import → 202-style queued/running operation.
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == sessionId);
                var status = await new WorkforceImportApplyOperationService(db, TestTenantContext.WithTenant(tenantId))
                    .CompleteImportAsync(sessionId, current.Version, Actor, default);
                Assert.Equal("Queued", status.Status);
            }

            // Duplicate Complete import replays the same operation (no second op).
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == sessionId);
                await new WorkforceImportApplyOperationService(db, TestTenantContext.WithTenant(tenantId)).CompleteImportAsync(sessionId, current.Version, Actor, default);
                Assert.Equal(1, await db.WorkforceImportApplyOperations.CountAsync(o => o.SessionId == sessionId));
            }

            // Background worker processes it.
            await ProcessUntilTerminal(connectionString, tenantId, sessionId);

            await using (var db = CreateDb(connectionString, tenantId))
            {
                Assert.Equal(1, await db.Employees.CountAsync());
                var status = await new WorkforceImportApplyOperationService(db, TestTenantContext.WithTenant(tenantId)).GetStatusAsync(sessionId, default);
                Assert.Equal("Succeeded", status!.Status);
                Assert.Equal(1, status.Result!.AddedEmployeeCount);
            }
        });
    }

    [RelationalDatabaseFact]
    public async Task Reconciliation_reports_success_when_session_committed_before_operation_update()
    {
        const string csv = "Employee Number,First Name,Last Name,Employment Start,Organization,Title\n"
            + "E-500,Amina,Mansour,2021-02-01,OPS,Consultant\n";
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            await SeedOpsOrg(connectionString, tenantId, today);
            var sessionId = await IntakeAndReview(connectionString, tenantId, csv, today);

            // Simulate crash: canonical commit happened via the orchestrator, but a Running op was
            // never marked succeeded.
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var session = await db.WorkforceImportSessions.SingleAsync(s => s.Id == sessionId);
                session.BeginApply(session.ReviewDigest ?? "", Actor);
                var op = WorkforceImportApplyOperation.Queue(tenantId, sessionId, Actor);
                op.AcquireLock("dead-node");
                db.WorkforceImportApplyOperations.Add(op);
                await db.SaveChangesAsync();
            }
            await using (var db = CreateDb(connectionString, tenantId))
                await Apply(db, tenantId).ExecuteAsync(sessionId, Actor, null, default); // commits the session

            await using (var db = CreateDb(connectionString, tenantId))
            {
                var op = await db.WorkforceImportApplyOperations.SingleAsync(o => o.SessionId == sessionId);
                Assert.Equal(WorkforceImportApplyStatus.Running, op.Status); // still Running (stale)
            }

            // Reconciliation on the next worker pass detects the committed session and reports success.
            await ProcessUntilTerminal(connectionString, tenantId, sessionId);
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var op = await db.WorkforceImportApplyOperations.SingleAsync(o => o.SessionId == sessionId);
                Assert.Equal(WorkforceImportApplyStatus.Succeeded, op.Status);
                Assert.Equal(1, await db.Employees.CountAsync()); // no re-apply / duplicate
            }
        });
    }

    [RelationalDatabaseFact]
    public async Task Apply_returns_structured_ReviewOutdated_when_referenced_org_changes()
    {
        const string csv = "Employee Number,First Name,Last Name,Employment Start,Organization,Title\n"
            + "E-600,Amina,Mansour,2021-02-01,OPS,Consultant\n";
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            Guid opsUnitId;
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var org = new EY.HRPlatform.CoreHR.Features.Organization.OrganizationService(db, TestTenantContext.WithTenant(tenantId));
                await org.GetTypesAsync(default);
                var root = await org.CreateRootAsync(new EY.HRPlatform.CoreHR.Features.Organization.CreateOrganizationRootRequest("ASTERIA", "Asteria", today), default);
                var unit = await org.CreateUnitAsync(new EY.HRPlatform.CoreHR.Features.Organization.CreateOrganizationUnitRequest(
                    "OPS", "Operations", EY.HRPlatform.CoreHR.Domain.Entities.OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default);
                opsUnitId = unit.Id;
            }
            var sessionId = await IntakeAndReview(connectionString, tenantId, csv, today);

            // Reviewed as New against OPS. Now the referenced OPS unit is inactivated as of today —
            // the resolved OrgUnit changes, so applying must not silently adapt.
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var org = new EY.HRPlatform.CoreHR.Features.Organization.OrganizationService(db, TestTenantContext.WithTenant(tenantId));
                var unit = await org.GetUnitAsync(opsUnitId, today, default);
                await org.InactivateAsync(opsUnitId, unit.Version,
                    new EY.HRPlatform.CoreHR.Features.Organization.InactivateOrganizationUnitRequest(today, "Inactivate"), default);
            }

            await FreezeAsync(connectionString, tenantId, sessionId);
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var ex = await Assert.ThrowsAsync<WorkforceImportApplyException>(() => Apply(db, tenantId).ExecuteAsync(sessionId, Actor, null, default));
                Assert.Equal(WorkforceImportApplyFailureKind.ReviewOutdated, ex.Kind);
                Assert.NotNull(ex.Outdated);
                Assert.True(ex.Outdated!.AffectedCount >= 1);
            }
            await using (var db = CreateDb(connectionString, tenantId))
                Assert.Equal(0, await db.Employees.CountAsync()); // nothing added on stale review
        });
    }

    [RelationalDatabaseFact]
    public async Task Finish_no_work_terminally_completes_all_existing_source_without_apply()
    {
        // Both rows match existing employees → NothingNew, no apply operation.
        const string csv = "Employee Number,First Name,Last Name,Employment Start,Organization,Title\n"
            + "E-700,Amina,Mansour,2021-02-01,OPS,Consultant\n";
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            Guid opsUnitId;
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var org = new EY.HRPlatform.CoreHR.Features.Organization.OrganizationService(db, TestTenantContext.WithTenant(tenantId));
                await org.GetTypesAsync(default);
                var root = await org.CreateRootAsync(new EY.HRPlatform.CoreHR.Features.Organization.CreateOrganizationRootRequest("ASTERIA", "Asteria", today), default);
                var unit = await org.CreateUnitAsync(new EY.HRPlatform.CoreHR.Features.Organization.CreateOrganizationUnitRequest(
                    "OPS", "Operations", EY.HRPlatform.CoreHR.Domain.Entities.OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default);
                opsUnitId = unit.Id;
                // Existing employee E-700 already in Fusion → the row is an anchor, nothing new.
                var emp = EY.HRPlatform.CoreHR.Domain.Entities.Employee.Create(tenantId, "Amina", "Mansour", "amina@x.com", employeeNumber: "E-700");
                db.Employees.Add(emp);
                var tc = TestTenantContext.WithTenant(tenantId);
                var mutation = new EY.HRPlatform.CoreHR.Features.Workforce.Services.WorkforceMutationService(db, tc, new EY.HRPlatform.CoreHR.Features.Workforce.Services.WorkforceCanonicalResolver(db));
                await mutation.StartEmploymentAsync(emp.Id, new EY.HRPlatform.CoreHR.Features.Workforce.Services.StartEmploymentInput(today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc), null), null, default);
                await mutation.ChangeWorkAssignmentAsync(emp.Id, new EY.HRPlatform.CoreHR.Features.Workforce.Services.ChangeWorkAssignmentInput(opsUnitId, "Consultant", null, today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)), null, default);
                await db.SaveChangesAsync();
            }
            var sessionId = await IntakeAndReview(connectionString, tenantId, csv, today);

            await using (var db = CreateDb(connectionString, tenantId))
            {
                var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == sessionId);
                Assert.Equal(0, current.NewCount); // nothing new
                await new WorkforceImportSessionService(db, TestTenantContext.WithTenant(tenantId), new SafeTabularSourceReader(), new WorkforceImportSourceAdapter())
                    .FinishNoWorkAsync(sessionId, current.Version, Actor, default);
            }
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var session = await db.WorkforceImportSessions.Include(s => s.Source).SingleAsync(s => s.Id == sessionId);
                Assert.Equal(WorkforceImportStatus.Committed, session.Status); // meaningful terminal completion
                Assert.Null(session.Source.RawBytes); // PII purged
                Assert.Equal(0, await db.WorkforceImportApplyOperations.CountAsync(o => o.SessionId == sessionId)); // no apply operation
                Assert.Equal(1, await db.WorkforceImportHistories.CountAsync(h => h.SessionId == sessionId && h.AddedEmployeeCount == 0)); // history outcome
                Assert.Equal(1, await db.Employees.CountAsync()); // only the pre-existing anchor
            }
        });
    }

    [RelationalDatabaseFact]
    public async Task Apply_returns_ReviewOutdated_on_non_org_change_work_email_now_occupied()
    {
        const string csv = "Employee Number,First Name,Last Name,Work Email,Employment Start,Organization,Title\n"
            + ",Amina,Mansour,amina@asteria.example,2021-02-01,OPS,Consultant\n"; // generated number, new email
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            Guid opsUnitId;
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var org = new EY.HRPlatform.CoreHR.Features.Organization.OrganizationService(db, TestTenantContext.WithTenant(tenantId));
                await org.GetTypesAsync(default);
                var root = await org.CreateRootAsync(new EY.HRPlatform.CoreHR.Features.Organization.CreateOrganizationRootRequest("ASTERIA", "Asteria", today), default);
                var unit = await org.CreateUnitAsync(new EY.HRPlatform.CoreHR.Features.Organization.CreateOrganizationUnitRequest(
                    "OPS", "Operations", EY.HRPlatform.CoreHR.Domain.Entities.OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default);
                opsUnitId = unit.Id;
            }
            var sessionId = await IntakeAndReview(connectionString, tenantId, csv, today); // reviewed as New (email free)

            // A DIFFERENT employee now occupies that work email — non-Organization canonical change.
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var tc = TestTenantContext.WithTenant(tenantId);
                var other = EY.HRPlatform.CoreHR.Domain.Entities.Employee.Create(tenantId, "Someone", "Else", "amina@asteria.example", employeeNumber: "X-1");
                db.Employees.Add(other);
                var mutation = new EY.HRPlatform.CoreHR.Features.Workforce.Services.WorkforceMutationService(db, tc, new EY.HRPlatform.CoreHR.Features.Workforce.Services.WorkforceCanonicalResolver(db));
                await mutation.StartEmploymentAsync(other.Id, new EY.HRPlatform.CoreHR.Features.Workforce.Services.StartEmploymentInput(today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc), null), null, default);
                await mutation.ChangeWorkAssignmentAsync(other.Id, new EY.HRPlatform.CoreHR.Features.Workforce.Services.ChangeWorkAssignmentInput(opsUnitId, "Analyst", null, today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)), null, default);
                await db.SaveChangesAsync();
            }

            await FreezeAsync(connectionString, tenantId, sessionId);
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var ex = await Assert.ThrowsAsync<WorkforceImportApplyException>(() => Apply(db, tenantId).ExecuteAsync(sessionId, Actor, null, default));
                Assert.Equal(WorkforceImportApplyFailureKind.ReviewOutdated, ex.Kind);
                Assert.True(ex.Outdated!.AffectedCount >= 1);
            }
            await using (var db = CreateDb(connectionString, tenantId))
                Assert.Equal(1, await db.Employees.CountAsync()); // only the occupier; nothing imported
        });
    }

    [RelationalDatabaseFact]
    public async Task Happy_establishment_generates_numbers_allows_blank_email_and_resolves_same_import_manager()
    {
        // Historical employment starts; current work established at the baseline (no source work date);
        // blank Employee Number (→ generated); blank Work Email (optional); same-import manager chain.
        const string csv = "Employee Number,First Name,Last Name,Work Email,Employment Start,Organization,Title,Manager\n"
            + "E-500,Youssef,BenAli,youssef@asteria.test,2018-03-01,OPS,Director,\n"
            + "E-501,Amina,Mansour,,2020-06-01,OPS,Consultant,E-500\n"
            + ",Sami,Ali,sami@asteria.test,2019-09-01,OPS,Analyst,E-501\n";
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            await SeedOpsOrg(connectionString, tenantId, today);
            var sessionId = await IntakeAndReview(connectionString, tenantId, csv, today);

            await using (var db = CreateDb(connectionString, tenantId))
            {
                var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == sessionId);
                var summary = await Review(db, tenantId).RecomputeAndSaveAsync(sessionId, current.Version, Actor, default);
                Assert.Equal(3, summary.Counts.New);
                Assert.Equal(0, summary.Counts.NeedsAttention);
                Assert.True(summary.CanCommit); // one readiness contract: Ready == apply-able
            }

            await FreezeAsync(connectionString, tenantId, sessionId);
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var result = await Apply(db, tenantId).ExecuteAsync(sessionId, Actor, null, default);
                Assert.Equal(3, result.AddedEmployeeCount);
                Assert.Equal(2, result.ManagerRelationshipCount);
            }

            await using (var db = CreateDb(connectionString, tenantId))
            {
                Assert.Equal(3, await db.Employees.CountAsync());
                // Blank source number was generated and preserved; managers kept their stable numbers.
                var sami = await db.Employees.SingleAsync(e => e.FirstName == "Sami");
                Assert.False(string.IsNullOrWhiteSpace(sami.EmployeeNumber));
                // Blank optional email is valid, never fabricated.
                var amina = await db.Employees.SingleAsync(e => e.FirstName == "Amina");
                Assert.True(string.IsNullOrWhiteSpace(amina.Email));
                // Employment keeps the historical hire date; current work is established from each
                // employee's Employment Start (no source work date), never the import day.
                var aminaEmployment = await db.Employments.SingleAsync(e => e.EmployeeId == amina.Id && e.EffectiveTo == null);
                Assert.Equal(new DateOnly(2020, 6, 1), DateOnly.FromDateTime(aminaEmployment.EffectiveFrom));
                var youssef = await db.Employees.SingleAsync(e => e.FirstName == "Youssef");
                var youssefAssignment = await db.WorkAssignments.SingleAsync(w => w.EmployeeId == youssef.Id && w.EffectiveTo == null);
                var aminaAssignment = await db.WorkAssignments.SingleAsync(w => w.EmployeeId == amina.Id && w.EffectiveTo == null);
                var samiAssignment = await db.WorkAssignments.SingleAsync(w => w.EmployeeId == sami.Id && w.EffectiveTo == null);
                Assert.Equal(new DateOnly(2018, 3, 1), DateOnly.FromDateTime(youssefAssignment.EffectiveFrom));
                Assert.Equal(new DateOnly(2020, 6, 1), DateOnly.FromDateTime(aminaAssignment.EffectiveFrom));
                Assert.Equal(new DateOnly(2019, 9, 1), DateOnly.FromDateTime(samiAssignment.EffectiveFrom));
                Assert.NotEqual(today, DateOnly.FromDateTime(youssefAssignment.EffectiveFrom)); // no longer the import day
                // The initial primary manager relationship begins at the later of the subject's and the
                // manager's assignment dates, so it never predates either assignment.
                var aminaManagerRel = await db.ManagerRelationships.SingleAsync(m => m.SubjectEmployeeId == amina.Id && m.EffectiveTo == null);
                Assert.Equal(new DateOnly(2020, 6, 1), DateOnly.FromDateTime(aminaManagerRel.EffectiveFrom)); // max(Amina 2020-06, Youssef 2018-03)
                var samiManagerRel = await db.ManagerRelationships.SingleAsync(m => m.SubjectEmployeeId == sami.Id && m.EffectiveTo == null);
                Assert.Equal(new DateOnly(2020, 6, 1), DateOnly.FromDateTime(samiManagerRel.EffectiveFrom)); // max(Sami 2019-09, Amina 2020-06)
            }
        });
    }

    [RelationalDatabaseFact]
    public async Task Historical_work_dates_before_org_fusion_establishment_are_accepted_and_returned_by_active_as_of()
    {
        // Current work dated years before the Organization was established in Fusion. The unit's Fusion
        // EstablishedFrom is the import date, not proof the real unit did not exist earlier, so these
        // establish cleanly (regression: an imported-today OrgUnit accepts a historical WorkAssignment).
        const string csv = "Employee Number,First Name,Last Name,Employment Start,Work Details Effective From,Organization,Title\n"
            + "E-600,Amina,Mansour,2018-01-01,2019-01-01,OPS,Consultant\n"
            + "E-601,Youssef,BenAli,2017-05-01,2020-03-01,OPS,Director\n";
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow); // OPS established today; source work dates are historical
            await SeedOpsOrg(connectionString, tenantId, today);
            var sessionId = await IntakeAndReview(connectionString, tenantId, csv, today);

            await using (var db = CreateDb(connectionString, tenantId))
            {
                var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == sessionId);
                var summary = await Review(db, tenantId).RecomputeAndSaveAsync(sessionId, current.Version, Actor, default);
                Assert.Equal(2, summary.Counts.New);
                Assert.Equal(0, summary.Counts.NeedsAttention); // historical work dates no longer block
                Assert.True(summary.CanCommit);
            }

            await FreezeAsync(connectionString, tenantId, sessionId);
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var result = await Apply(db, tenantId).ExecuteAsync(sessionId, Actor, null, default);
                Assert.Equal(2, result.AddedEmployeeCount);
            }

            await using (var db = CreateDb(connectionString, tenantId))
            {
                var amina = await db.Employees.SingleAsync(e => e.FirstName == "Amina");
                var youssef = await db.Employees.SingleAsync(e => e.FirstName == "Youssef");
                var aminaAssignment = await db.WorkAssignments.SingleAsync(w => w.EmployeeId == amina.Id && w.EffectiveTo == null);
                var youssefAssignment = await db.WorkAssignments.SingleAsync(w => w.EmployeeId == youssef.Id && w.EffectiveTo == null);
                Assert.Equal(new DateOnly(2019, 1, 1), DateOnly.FromDateTime(aminaAssignment.EffectiveFrom)); // source work date preserved
                Assert.Equal(new DateOnly(2020, 3, 1), DateOnly.FromDateTime(youssefAssignment.EffectiveFrom));

                // Core active-as-of resolution returns the historical workforce for a Cycle whose start
                // predates the import day: as-of 2021-01-01 both are active; before either assignment, none.
                var snapshots = new EY.HRPlatform.CoreHR.Features.Workforce.Services.InternalWorkforceSnapshotService(db);
                var asOfBeforeImport = await snapshots.GetAllActiveAsOfAsync(new DateTime(2021, 1, 1, 0, 0, 0, DateTimeKind.Utc), includeInactive: false, default);
                Assert.Equal(2, asOfBeforeImport.Count);
                Assert.Contains(asOfBeforeImport, s => s.EmployeeId == amina.Id);
                Assert.Contains(asOfBeforeImport, s => s.EmployeeId == youssef.Id);

                var asOfBeforeAnyAssignment = await snapshots.GetAllActiveAsOfAsync(new DateTime(2016, 1, 1, 0, 0, 0, DateTimeKind.Utc), includeInactive: false, default);
                Assert.Empty(asOfBeforeAnyAssignment);
            }
        });
    }

    [RelationalDatabaseFact]
    public async Task Explicit_normalization_moves_work_and_manager_to_baseline_and_apply_succeeds()
    {
        const string csv = "Employee Number,First Name,Last Name,Employment Start,Work Details Effective From,Organization,Title,Manager\n"
            + "E-700,Youssef,BenAli,2017-05-01,2019-02-01,OPS,Director,\n"
            + "E-701,Amina,Mansour,2018-01-01,2019-01-01,OPS,Consultant,E-700\n";
        await WithDatabaseAsync(async (connectionString, tenantId) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            await SeedOpsOrg(connectionString, tenantId, today);
            var sessionId = await IntakeAndReview(connectionString, tenantId, csv, today);

            // The administrator may still deliberately normalize the whole establishment to the baseline.
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == sessionId);
                var normalized = await Review(db, tenantId).ApplyDecisionAsync(
                    sessionId, current.Version, doc => doc.NormalizeWorkDatesToBaseline = true, Actor, default);
                Assert.True(normalized.CanCommit);
                Assert.Equal(2, normalized.Counts.New);
            }

            await FreezeAsync(connectionString, tenantId, sessionId);
            await using (var db = CreateDb(connectionString, tenantId))
            {
                var result = await Apply(db, tenantId).ExecuteAsync(sessionId, Actor, null, default);
                Assert.Equal(2, result.AddedEmployeeCount);
                Assert.Equal(1, result.ManagerRelationshipCount);
            }

            await using (var db = CreateDb(connectionString, tenantId))
            {
                // Whole establishment context (work + initial manager) normalized to the baseline together.
                Assert.All(await db.WorkAssignments.ToListAsync(), a => Assert.Equal(today, DateOnly.FromDateTime(a.EffectiveFrom)));
                Assert.All(await db.ManagerRelationships.Where(m => m.EffectiveTo == null).ToListAsync(),
                    m => Assert.Equal(today, DateOnly.FromDateTime(m.EffectiveFrom)));
                // Employment tenure is untouched by normalization.
                var youssef = await db.Employees.SingleAsync(e => e.FirstName == "Youssef");
                var employment = await db.Employments.SingleAsync(e => e.EmployeeId == youssef.Id && e.EffectiveTo == null);
                Assert.Equal(new DateOnly(2017, 5, 1), DateOnly.FromDateTime(employment.EffectiveFrom));
            }
        });
    }

    private async Task FreezeAsync(string connectionString, Guid tenantId, Guid sessionId)
    {
        await using var db = CreateDb(connectionString, tenantId);
        var session = await db.WorkforceImportSessions.SingleAsync(s => s.Id == sessionId);
        session.BeginApply(session.ReviewDigest ?? "", Actor);
        await db.SaveChangesAsync();
    }

    private async Task SeedOpsOrg(string connectionString, Guid tenantId, DateOnly today)
    {
        await using var db = CreateDb(connectionString, tenantId);
        var org = new EY.HRPlatform.CoreHR.Features.Organization.OrganizationService(db, TestTenantContext.WithTenant(tenantId));
        await org.GetTypesAsync(default);
        var root = await org.CreateRootAsync(new EY.HRPlatform.CoreHR.Features.Organization.CreateOrganizationRootRequest("ASTERIA", "Asteria", today), default);
        await org.CreateUnitAsync(new EY.HRPlatform.CoreHR.Features.Organization.CreateOrganizationUnitRequest(
            "OPS", "Operations", EY.HRPlatform.CoreHR.Domain.Entities.OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default);
    }

    private async Task<Guid> IntakeAndReview(string connectionString, Guid tenantId, string csv, DateOnly today)
    {
        Guid sessionId;
        await using (var db = CreateDb(connectionString, tenantId))
            sessionId = (await NewService(db, tenantId).IntakeAsync(
                new WorkforceImportIntakeRequest(Guid.NewGuid(), today, new MemoryStream(Encoding.UTF8.GetBytes(csv)), "wf.csv", "text/csv", null, Actor), default)).Session!.Id;
        await using (var db = CreateDb(connectionString, tenantId))
        {
            var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == sessionId);
            await Review(db, tenantId).RecomputeAndSaveAsync(sessionId, current.Version, Actor, default);
        }
        return sessionId;
    }

    private async Task ProcessUntilTerminal(string connectionString, Guid tenantId, Guid sessionId)
    {
        var provider = new Microsoft.Extensions.DependencyInjection.ServiceCollection()
            .AddScoped(_ => CreateDb(connectionString, tenantId))
            .AddScoped<EY.HRPlatform.SharedKernel.Multitenancy.TenantContext>()
            .AddScoped<EY.HRPlatform.SharedKernel.Multitenancy.ITenantContext>(sp => sp.GetRequiredService<EY.HRPlatform.SharedKernel.Multitenancy.TenantContext>())
            .AddScoped(sp => new WorkforceImportApplyOrchestrator(
                sp.GetRequiredService<CoreHRDbContext>(), sp.GetRequiredService<EY.HRPlatform.SharedKernel.Multitenancy.ITenantContext>(),
                new WorkforceImportInterpreter(), new WorkforceImportResolver(),
                new WorkforceImportSnapshotLoader(sp.GetRequiredService<CoreHRDbContext>(), new EY.HRPlatform.CoreHR.Features.Organization.OrganizationService(sp.GetRequiredService<CoreHRDbContext>(), sp.GetRequiredService<EY.HRPlatform.SharedKernel.Multitenancy.ITenantContext>())),
                new EY.HRPlatform.CoreHR.Features.Workforce.Services.WorkforceMutationService(sp.GetRequiredService<CoreHRDbContext>(), sp.GetRequiredService<EY.HRPlatform.SharedKernel.Multitenancy.ITenantContext>(), new EY.HRPlatform.CoreHR.Features.Workforce.Services.WorkforceCanonicalResolver(sp.GetRequiredService<CoreHRDbContext>())),
                new EY.HRPlatform.CoreHR.Features.Workforce.Services.EmployeeNumberAllocatorService(sp.GetRequiredService<CoreHRDbContext>(), sp.GetRequiredService<EY.HRPlatform.SharedKernel.Multitenancy.ITenantContext>())))
            .BuildServiceProvider();
        var processor = new WorkforceImportApplyProcessor(provider);
        for (var i = 0; i < 5; i++)
        {
            await processor.ProcessNextAsync(default);
            await using var db = CreateDb(connectionString, tenantId);
            var op = await db.WorkforceImportApplyOperations.SingleOrDefaultAsync(o => o.SessionId == sessionId);
            if (op is not null && op.IsTerminal) return;
        }
    }

    // ---- helpers ----

    private static WorkforceImportApplyOrchestrator Apply(CoreHRDbContext db, Guid tenantId)
    {
        var tenantContext = TestTenantContext.WithTenant(tenantId);
        var resolverInstance = new EY.HRPlatform.CoreHR.Features.Workforce.Services.WorkforceCanonicalResolver(db);
        return new WorkforceImportApplyOrchestrator(db, tenantContext, new WorkforceImportInterpreter(), new WorkforceImportResolver(),
            new WorkforceImportSnapshotLoader(db, new EY.HRPlatform.CoreHR.Features.Organization.OrganizationService(db, tenantContext)),
            new EY.HRPlatform.CoreHR.Features.Workforce.Services.WorkforceMutationService(db, tenantContext, resolverInstance),
            new EY.HRPlatform.CoreHR.Features.Workforce.Services.EmployeeNumberAllocatorService(db, tenantContext));
    }

    private static WorkforceImportReviewService Review(CoreHRDbContext db, Guid tenantId)
        => new(db, TestTenantContext.WithTenant(tenantId), new WorkforceImportInterpreter(), new WorkforceImportResolver(),
            new WorkforceImportSnapshotLoader(db, new EY.HRPlatform.CoreHR.Features.Organization.OrganizationService(db, TestTenantContext.WithTenant(tenantId))));

    private static WorkforceImportSessionService NewService(CoreHRDbContext db, Guid tenantId)
        => new(db, TestTenantContext.WithTenant(tenantId), new SafeTabularSourceReader(), new WorkforceImportSourceAdapter());

    private static WorkforceImportIntakeRequest IntakeRequest(Guid token)
        => new(token, new DateOnly(2026, 8, 17), new MemoryStream(Encoding.UTF8.GetBytes(Csv)), "people.csv", "text/csv", null, Actor);

    private static WorkforceImportSession NewSession(Guid tenantId, Guid? token = null)
        => WorkforceImportSession.Create(tenantId, new DateOnly(2026, 8, 17), token ?? Guid.NewGuid(), Guid.NewGuid().ToString("N"), "CSV", Actor, DateTime.UtcNow);

    private static CoreHRDbContext CreateDb(string connectionString, Guid tenantId)
        => new(new DbContextOptionsBuilder<CoreHRDbContext>().UseNpgsql(connectionString).Options, TestTenantContext.WithTenant(tenantId));

    private static async Task WithDatabaseAsync(Func<string, Guid, Task> body)
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_COREHR_RELATIONAL_TEST_CONNECTION")!;
        var databaseName = $"fusion_corehr_wfi_{Guid.NewGuid():N}";
        var connectionString = new NpgsqlConnectionStringBuilder(baseConnection) { Database = databaseName, Pooling = false }.ConnectionString;
        try
        {
            await CreateDatabaseAsync(baseConnection, databaseName);
            var tenantId = Guid.NewGuid();
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
