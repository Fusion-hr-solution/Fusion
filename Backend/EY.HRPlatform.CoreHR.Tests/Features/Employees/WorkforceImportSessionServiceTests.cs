using System.Text;
using EY.HRPlatform.CoreHR.Features.Employees.Import;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public sealed class WorkforceImportSessionServiceTests
{
    private static readonly Guid Tenant = Guid.NewGuid();
    private static readonly WorkforceImportActor Actor = new(Guid.NewGuid(), "Amina");
    private const string CsvA = "Employee Number,First Name,Last Name\n001,Amina,Mansour\n002,Youssef,Ben Ali\n";
    private const string CsvB = "Employee Number,First Name,Last Name\n003,Leila,Haddad\n";

    private static (WorkforceImportSessionService Service, CoreHRDbContext Context) Build(string dbName)
    {
        var tenantContext = TestTenantContext.WithTenant(Tenant);
        var context = TestDbContextFactory.Create(tenantContext, dbName);
        var service = new WorkforceImportSessionService(context, tenantContext, new SafeTabularSourceReader(), new WorkforceImportSourceAdapter());
        return (service, context);
    }

    private static WorkforceImportIntakeRequest Intake(Guid token, string csv, TimeSpan? retention = null)
        => new(token, new DateOnly(2026, 8, 17), new MemoryStream(Encoding.UTF8.GetBytes(csv)), "people.csv", "text/csv", null, Actor, retention);

    [Fact]
    public async Task Intake_creates_session_source_and_rows()
    {
        var (service, context) = Build(nameof(Intake_creates_session_source_and_rows));
        var outcome = await service.IntakeAsync(Intake(Guid.NewGuid(), CsvA), default);

        Assert.Equal(WorkforceImportIntakeKind.Ready, outcome.Kind);
        Assert.False(outcome.Replayed);
        var session = outcome.Session!;
        Assert.Equal(WorkforceImportStatus.Intake, session.Status);
        Assert.Equal(2, await context.WorkforceImportRows.CountAsync(r => r.SessionId == session.Id));
        Assert.NotNull(session.Source.RawBytes);
        Assert.Contains("Employee Number", session.Source.ColumnsJson);
    }

    [Fact]
    public async Task Intake_same_token_same_source_replays_without_duplicate()
    {
        var (service, context) = Build(nameof(Intake_same_token_same_source_replays_without_duplicate));
        var token = Guid.NewGuid();
        var first = await service.IntakeAsync(Intake(token, CsvA), default);
        var replay = await service.IntakeAsync(Intake(token, CsvA), default);

        Assert.Equal(WorkforceImportIntakeKind.Ready, replay.Kind);
        Assert.True(replay.Replayed);
        Assert.Equal(first.Session!.Id, replay.Session!.Id);
        Assert.Equal(1, await context.WorkforceImportSessions.CountAsync());
    }

    [Fact]
    public async Task Intake_second_token_while_active_returns_active_session()
    {
        var (service, _) = Build(nameof(Intake_second_token_while_active_returns_active_session));
        await service.IntakeAsync(Intake(Guid.NewGuid(), CsvA), default);
        var second = await service.IntakeAsync(Intake(Guid.NewGuid(), CsvB), default);

        Assert.Equal(WorkforceImportIntakeKind.ActiveSessionExists, second.Kind);
        Assert.NotNull(second.Session);
    }

    [Fact]
    public async Task Intake_same_token_different_source_conflicts()
    {
        var (service, _) = Build(nameof(Intake_same_token_different_source_conflicts));
        var token = Guid.NewGuid();
        await service.IntakeAsync(Intake(token, CsvA), default);
        var conflict = await service.IntakeAsync(Intake(token, CsvB), default);

        Assert.Equal(WorkforceImportIntakeKind.Conflict, conflict.Kind);
    }

    [Fact]
    public async Task ReplaceDecisions_autosaves_and_persists_revision()
    {
        var (service, context) = Build(nameof(ReplaceDecisions_autosaves_and_persists_revision));
        var session = (await service.IntakeAsync(Intake(Guid.NewGuid(), CsvA), default)).Session!;
        await service.ReplaceDecisionsAsync(session.Id, "{\"dateFormat\":\"DD/MM/YYYY\"}", session.Version, Actor, default);

        var reloaded = await context.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == session.Id);
        Assert.Equal(1, reloaded.DecisionRevision);
        Assert.Contains("DD/MM/YYYY", reloaded.DecisionsJson);
        Assert.NotNull(reloaded.DecisionsUpdatedAt);
    }

    [Fact]
    public async Task Header_clarification_intake_persists_session_with_candidates_and_no_rows()
    {
        const string ambiguousCsv = "Employee Number,First Name,Department\nMatricule,Prénom,Département\n001,Amina,Ops\n";
        var (service, context) = Build(nameof(Header_clarification_intake_persists_session_with_candidates_and_no_rows));
        var intake = await service.IntakeAsync(Intake(Guid.NewGuid(), ambiguousCsv), default);

        Assert.Equal(WorkforceImportIntakeKind.HeaderClarificationRequired, intake.Kind);
        Assert.NotNull(intake.HeaderCandidates);
        Assert.True(intake.HeaderCandidates!.Count > 1);
        // Session + source (bytes) persisted so the choice needs no re-upload; rows await the choice.
        Assert.Equal(0, await context.WorkforceImportRows.CountAsync(r => r.SessionId == intake.Session!.Id));
        Assert.NotNull(intake.Session!.Source.RawBytes);
    }

    [Fact]
    public async Task PurgeExpired_expires_and_purges_past_window_sessions()
    {
        var (service, context) = Build(nameof(PurgeExpired_expires_and_purges_past_window_sessions));
        var session = (await service.IntakeAsync(Intake(Guid.NewGuid(), CsvA, TimeSpan.FromMinutes(1)), default)).Session!;

        var purged = await service.PurgeExpiredAsync(DateTime.UtcNow.AddDays(1), default);

        Assert.Equal(1, purged);
        var reloaded = await context.WorkforceImportSessions.Include(s => s.Source).Include(s => s.Rows)
            .AsNoTracking().SingleAsync(s => s.Id == session.Id);
        Assert.Equal(WorkforceImportStatus.Expired, reloaded.Status);
        Assert.Null(reloaded.Source.RawBytes);
        Assert.All(reloaded.Rows, row => Assert.Null(row.SourceCellsJson));
    }
}
