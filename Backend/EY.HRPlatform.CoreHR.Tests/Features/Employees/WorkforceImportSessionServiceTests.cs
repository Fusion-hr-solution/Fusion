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
    private static readonly ImportActor Actor = new(Guid.NewGuid(), "Amina");
    private const string CsvA = "Employee Number,First Name,Last Name\n001,Amina,Mansour\n002,Youssef,Ben Ali\n";
    private const string CsvB = "Employee Number,First Name,Last Name\n003,Leila,Haddad\n";

    private static (WorkforceImportSessionService Service, CoreHRDbContext Context) Build(string dbName)
    {
        var tenantContext = TestTenantContext.WithTenant(Tenant);
        var context = TestDbContextFactory.Create(tenantContext, dbName);
        return (WorkforceImportTestKit.Sessions(context, Tenant), context);
    }

    private static WorkforceImportIntakeRequest Intake(Guid token, string csv)
        => new(token, new DateOnly(2026, 8, 17), new MemoryStream(Encoding.UTF8.GetBytes(csv)), "people.csv", "text/csv", null, Actor);

    [Fact]
    public async Task Intake_creates_an_active_attempt_and_derives_its_proposal()
    {
        var (service, context) = Build(nameof(Intake_creates_an_active_attempt_and_derives_its_proposal));
        var outcome = await service.IntakeAsync(Intake(Guid.NewGuid(), CsvA), default);

        Assert.Equal(WorkforceImportIntakeKind.Ready, outcome.Kind);
        Assert.False(outcome.Replayed);
        var session = outcome.Session!;
        Assert.Equal(WorkforceImportStatus.Active, session.Status);
        Assert.Equal(2, await context.WorkforceImportRows.CountAsync(r => r.SessionId == session.Id));
        Assert.NotNull(session.Source.RawBytes);
        Assert.Contains("Employee Number", session.Source.ColumnsJson);
        // Derived at intake: this file lacks required columns, so Match is not complete yet.
        Assert.False(session.MatchComplete);
        Assert.NotNull(session.ProposalFingerprint);
    }

    [Fact]
    public async Task Intake_same_token_same_source_replays_without_duplicate()
    {
        var (service, context) = Build(nameof(Intake_same_token_same_source_replays_without_duplicate));
        var token = Guid.NewGuid();
        var first = await service.IntakeAsync(Intake(token, CsvA), default);
        var replay = await service.IntakeAsync(Intake(token, CsvA), default);

        Assert.True(replay.Replayed);
        Assert.Equal(first.Session!.Id, replay.Session!.Id);
        Assert.Equal(1, await context.WorkforceImportSessions.CountAsync());
    }

    [Fact]
    public async Task Intake_same_token_different_source_conflicts()
    {
        var (service, _) = Build(nameof(Intake_same_token_different_source_conflicts));
        var token = Guid.NewGuid();
        await service.IntakeAsync(Intake(token, CsvA), default);
        Assert.Equal(WorkforceImportIntakeKind.Conflict, (await service.IntakeAsync(Intake(token, CsvB), default)).Kind);
    }

    [Fact]
    public async Task A_second_file_is_a_new_attempt_and_resume_offers_the_latest()
    {
        // Lifecycle parity with Organization Import: attempts are independent; a corrected file is a new attempt.
        var (service, context) = Build(nameof(A_second_file_is_a_new_attempt_and_resume_offers_the_latest));
        var first = await service.IntakeAsync(Intake(Guid.NewGuid(), CsvA), default);
        var second = await service.IntakeAsync(Intake(Guid.NewGuid(), CsvB), default);

        Assert.Equal(WorkforceImportIntakeKind.Ready, second.Kind);
        Assert.NotEqual(first.Session!.Id, second.Session!.Id);
        Assert.Equal(2, await context.WorkforceImportSessions.CountAsync(s => s.Status == WorkforceImportStatus.Active));
        Assert.Equal(second.Session.Id, (await service.GetActiveAsync(default))!.Id);
    }

    [Fact]
    public async Task Discard_is_explicit_terminal_and_purges()
    {
        var (service, context) = Build(nameof(Discard_is_explicit_terminal_and_purges));
        var session = (await service.IntakeAsync(Intake(Guid.NewGuid(), CsvA), default)).Session!;
        Assert.True(await service.DiscardAsync(session.Id, session.Version, Actor, default));

        var reloaded = await context.WorkforceImportSessions.Include(s => s.Source).Include(s => s.Rows).AsNoTracking().SingleAsync(s => s.Id == session.Id);
        Assert.Equal(WorkforceImportStatus.Discarded, reloaded.Status);
        Assert.Null(reloaded.Source.RawBytes);
        Assert.All(reloaded.Rows, row => Assert.Null(row.SourceCellsJson));
        await Assert.ThrowsAsync<WorkforceImportReviewException>(() =>
            service.SelectHeaderRowAsync(session.Id, 0, reloaded.Version, Actor, default));
    }

    [Fact]
    public async Task Header_clarification_intake_persists_attempt_with_candidates_and_no_rows()
    {
        const string ambiguousCsv = "Employee Number,First Name,Department\nMatricule,Prénom,Département\n001,Amina,Ops\n";
        var (service, context) = Build(nameof(Header_clarification_intake_persists_attempt_with_candidates_and_no_rows));
        var intake = await service.IntakeAsync(Intake(Guid.NewGuid(), ambiguousCsv), default);

        Assert.Equal(WorkforceImportIntakeKind.HeaderClarificationRequired, intake.Kind);
        Assert.True(intake.HeaderCandidates!.Count > 1);
        Assert.Equal(0, await context.WorkforceImportRows.CountAsync(r => r.SessionId == intake.Session!.Id));
        Assert.NotNull(intake.Session!.Source.RawBytes);
    }
}
