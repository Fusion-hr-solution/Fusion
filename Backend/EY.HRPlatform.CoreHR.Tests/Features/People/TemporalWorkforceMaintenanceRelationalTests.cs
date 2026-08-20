using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Features.People;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.Features.Organization;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EY.HRPlatform.CoreHR.Tests.Features.People;

/// <summary>
/// Relational proofs for the Temporal Workforce Maintenance slice against real PostgreSQL:
/// effective-dated Change Work, independent Change Manager (incl. No manager), page-level as-of
/// resolution, upcoming discovery, cycle protection, past-date rejection, and a non-blocking
/// End Employment that releases direct reports.
/// </summary>
public sealed class TemporalWorkforceMaintenanceRelationalTests
{
    private const string Actor = "test|Workforce Administrator";

    [RelationalDatabaseFact]
    public async Task Change_work_and_manager_are_independent_effective_dated_and_as_of_resolvable()
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_COREHR_RELATIONAL_TEST_CONNECTION")!;
        var databaseName = $"fusion_temporal_{Guid.NewGuid():N}";
        var connectionString = new NpgsqlConnectionStringBuilder(baseConnection) { Database = databaseName, Pooling = false }.ConnectionString;

        try
        {
            await CreateDatabaseAsync(baseConnection, databaseName);
            var tenantId = Guid.NewGuid();
            var today = DateTime.UtcNow.Date;
            var future = today.AddDays(30);
            await using var db = CreateDb(connectionString, tenantId);
            await db.Database.MigrateAsync();

            var ctx = await SetUpAsync(db, tenantId, today);

            // Baseline: Karim in AI Automation, "Consultant Senior", managed by Amina; nothing upcoming.
            var baseline = await ProfileAsync(db, ctx.Organization, ctx.KarimKey);
            Assert.Equal("Consultant Senior", baseline.Work!.JobTitle);
            Assert.Equal("AI Automation", baseline.Work.OrganizationName);
            Assert.Equal(ctx.AminaKey, baseline.PrimaryManager!.EmployeeKey);
            Assert.Empty(baseline.Upcoming);
            var assignmentsBefore = await db.WorkAssignments.CountAsync(a => a.EmployeeId == ctx.KarimId);

            // Change Work effective the future date → Customer Success / Senior Consultant.
            var changeWork = await new ChangeWorkCommandHandler(db, ctx.Mutation).Handle(
                new ChangeWorkCommand(ctx.KarimKey, future, ctx.CustomerSuccessId, "Senior Consultant", "Tunis", Actor), default);
            Assert.True(changeWork.IsSuccess, changeWork.IsFailure ? changeWork.Error.Message : null);
            Assert.True(changeWork.Value.IsScheduled);

            // Today is unchanged; the future date resolves the new work context.
            var todayAfterWork = await ProfileAsync(db, ctx.Organization, ctx.KarimKey);
            Assert.Equal("Consultant Senior", todayAfterWork.Work!.JobTitle);
            Assert.Equal("AI Automation", todayAfterWork.Work.OrganizationName);
            Assert.False(todayAfterWork.IsAsOf);

            var asOfWork = await ProfileAsync(db, ctx.Organization, ctx.KarimKey, future);
            Assert.True(asOfWork.IsAsOf);
            Assert.Equal("Senior Consultant", asOfWork.Work!.JobTitle);
            Assert.Equal("Customer Success", asOfWork.Work.OrganizationName);
            // Manager unchanged by a work change.
            Assert.Equal(ctx.AminaKey, asOfWork.PrimaryManager!.EmployeeKey);

            // Change Manager effective the same future date → Youssef, independent of work.
            var changeManager = await new ChangeManagerByKeyCommandHandler(db, ctx.Mutation).Handle(
                new ChangeManagerByKeyCommand(ctx.KarimKey, future, ctx.YoussefId, Actor), default);
            Assert.True(changeManager.IsSuccess, changeManager.IsFailure ? changeManager.Error.Message : null);

            // Manager-only change created NO new work assignment.
            var assignmentsAfter = await db.WorkAssignments.CountAsync(a => a.EmployeeId == ctx.KarimId);
            Assert.Equal(assignmentsBefore + 1, assignmentsAfter); // +1 from Change Work only.

            // Today manager still Amina; future manager Youssef.
            var todayAfterMgr = await ProfileAsync(db, ctx.Organization, ctx.KarimKey);
            Assert.Equal(ctx.AminaKey, todayAfterMgr.PrimaryManager!.EmployeeKey);
            var asOfMgr = await ProfileAsync(db, ctx.Organization, ctx.KarimKey, future);
            Assert.Equal(ctx.YoussefKey, asOfMgr.PrimaryManager!.EmployeeKey);

            // Upcoming on Today shows two distinct items on the same effective date.
            var upcoming = todayAfterMgr.Upcoming;
            Assert.Equal(2, upcoming.Count);
            Assert.Contains(upcoming, u => u.Kind == PeopleChangeKind.Work && u.EffectiveDate.Date == future);
            Assert.Contains(upcoming, u => u.Kind == PeopleChangeKind.Manager && u.EffectiveDate.Date == future);

            // No manager effective a later date → managerless after that date.
            var later = today.AddDays(60);
            var removeManager = await new ChangeManagerByKeyCommandHandler(db, ctx.Mutation).Handle(
                new ChangeManagerByKeyCommand(ctx.KarimKey, later, null, Actor), default);
            Assert.True(removeManager.IsSuccess, removeManager.IsFailure ? removeManager.Error.Message : null);
            var asOfNoManager = await ProfileAsync(db, ctx.Organization, ctx.KarimKey, later);
            Assert.Null(asOfNoManager.PrimaryManager);

            // Past-dated Change Work is rejected as a correction, not applied.
            var pastChange = await new ChangeWorkCommandHandler(db, ctx.Mutation).Handle(
                new ChangeWorkCommand(ctx.KarimKey, today.AddDays(-1), ctx.CustomerSuccessId, "Backdated", null, Actor), default);
            Assert.True(pastChange.IsFailure);
            Assert.Equal("WorkAssignment.PastDatedChange", pastChange.Error.Code);

            // Cycle protection: making Amina report to Karim (who reports to Amina today) is rejected.
            var cycle = await new ChangeManagerByKeyCommandHandler(db, ctx.Mutation).Handle(
                new ChangeManagerByKeyCommand(ctx.AminaKey, today, ctx.KarimId, Actor), default);
            Assert.True(cycle.IsFailure);
            Assert.Equal("Manager.Cycle", cycle.Error.Code);
        }
        finally
        {
            await DropDatabaseAsync(baseConnection, databaseName);
        }
    }

    [RelationalDatabaseFact]
    public async Task End_employment_releases_direct_reports_and_controls_active_as_of_truth()
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_COREHR_RELATIONAL_TEST_CONNECTION")!;
        var databaseName = $"fusion_endemp_{Guid.NewGuid():N}";
        var connectionString = new NpgsqlConnectionStringBuilder(baseConnection) { Database = databaseName, Pooling = false }.ConnectionString;

        try
        {
            await CreateDatabaseAsync(baseConnection, databaseName);
            var tenantId = Guid.NewGuid();
            var today = DateTime.UtcNow.Date;
            await using var db = CreateDb(connectionString, tenantId);
            await db.Database.MigrateAsync();

            var ctx = await SetUpAsync(db, tenantId, today);
            var lastEmployed = today.AddDays(15);

            // Preview surfaces the managerless-report consequence (Amina manages Karim).
            var preview = await new EndEmploymentPreviewQueryHandler(db, ctx.Mutation).Handle(
                new EndEmploymentPreviewQuery(ctx.AminaKey, lastEmployed), default);
            Assert.True(preview.IsSuccess);
            Assert.Equal(1, preview.Value.DirectReportCount);

            // End Amina's employment: employed THROUGH lastEmployed, inactive AFTER.
            var end = await new EndEmploymentCommandHandler(db, ctx.Mutation).Handle(
                new EndEmploymentCommand(ctx.AminaKey, lastEmployed, "Departure", Actor), default);
            Assert.True(end.IsSuccess, end.IsFailure ? end.Error.Message : null);

            var onLastDay = await ProfileAsync(db, ctx.Organization, ctx.AminaKey, lastEmployed);
            Assert.Equal(PeopleEmploymentState.Active, onLastDay.Employment.State);

            var afterEnd = await ProfileAsync(db, ctx.Organization, ctx.AminaKey, lastEmployed.AddDays(1));
            Assert.NotEqual(PeopleEmploymentState.Active, afterEnd.Employment.State);
            Assert.Null(afterEnd.Work);
            Assert.Null(afterEnd.PrimaryManager);

            // Karim is released — managerless after the boundary — rather than blocking the end.
            var karimAfter = await ProfileAsync(db, ctx.Organization, ctx.KarimKey, lastEmployed.AddDays(1));
            Assert.Null(karimAfter.PrimaryManager);
            // Karim on the last employed day still reports to Amina.
            var karimBefore = await ProfileAsync(db, ctx.Organization, ctx.KarimKey, lastEmployed);
            Assert.Equal(ctx.AminaKey, karimBefore.PrimaryManager!.EmployeeKey);
        }
        finally
        {
            await DropDatabaseAsync(baseConnection, databaseName);
        }
    }

    // --- Fixture ----------------------------------------------------------------------------------

    private sealed record Fixture(
        OrganizationService Organization,
        IWorkforceMutationService Mutation,
        Guid AiId, Guid CustomerSuccessId,
        Guid KarimId, string KarimKey,
        Guid AminaId, string AminaKey,
        Guid YoussefId, string YoussefKey);

    private static async Task<Fixture> SetUpAsync(CoreHRDbContext db, Guid tenantId, DateTime today)
    {
        var tenant = TestTenantContext.WithTenant(tenantId);
        var organization = new OrganizationService(db, tenant);
        var root = await organization.CreateRootAsync(
            new CreateOrganizationRootRequest("ASTERIA", "Asteria Group", DateOnly.FromDateTime(today)), default);
        var ai = await organization.CreateUnitAsync(
            new CreateOrganizationUnitRequest("AI", "AI Automation", OrganizationalUnitTypeCatalog.DepartmentId, root.Id, DateOnly.FromDateTime(today)), default);
        var cs = await organization.CreateUnitAsync(
            new CreateOrganizationUnitRequest("CS", "Customer Success", OrganizationalUnitTypeCatalog.DepartmentId, root.Id, DateOnly.FromDateTime(today)), default);

        var allocator = new EmployeeNumberAllocatorService(db, tenant);
        var mutation = new WorkforceMutationService(db, tenant, new WorkforceCanonicalResolver(db));

        var amina = await Hire(db, tenant, allocator, mutation, organization, "Amina", "Mansour", cs.Id, "Customer Success Director", today);
        var youssef = await Hire(db, tenant, allocator, mutation, organization, "Youssef", "Ben Ali", cs.Id, "Customer Growth Director", today);

        var aminaId = await IdOf(db, amina.EmployeeKey);
        var karim = await new AddExistingEmployeeCommandHandler(db, tenant, allocator, mutation, organization).Handle(
            new AddExistingEmployeeCommand(
                new AddExistingEmployeeRequest(
                    "Karim", "Zayed", null, null, null,
                    EmployeeNumberMode.Generated, null, new DateTime(2021, 2, 1), today,
                    "Full-time", ai.Id, "Consultant Senior", "Tunis", aminaId),
                Actor),
            default);
        if (karim.IsFailure) throw new InvalidOperationException(karim.Error.Message);

        return new Fixture(
            organization, mutation,
            ai.Id, cs.Id,
            await IdOf(db, karim.Value.EmployeeKey), karim.Value.EmployeeKey,
            aminaId, amina.EmployeeKey,
            await IdOf(db, youssef.EmployeeKey), youssef.EmployeeKey);
    }

    private static async Task<EstablishmentResultDto> Hire(
        CoreHRDbContext db, EY.HRPlatform.SharedKernel.Multitenancy.ITenantContext tenant,
        EmployeeNumberAllocatorService allocator, IWorkforceMutationService mutation, OrganizationService organization,
        string first, string last, Guid orgUnitId, string title, DateTime today)
    {
        var result = await new HireEmployeeCommandHandler(db, tenant, allocator, mutation, organization).Handle(
            new HireEmployeeCommand(
                new HireEmployeeRequest(first, last, null, null, null, EmployeeNumberMode.Generated, null, today, "Full-time", orgUnitId, title, null, null),
                Actor),
            default);
        if (result.IsFailure) throw new InvalidOperationException(result.Error.Message);
        return result.Value;
    }

    private static async Task<Guid> IdOf(CoreHRDbContext db, string employeeKey)
        => await db.Employees.Where(e => e.StableEmployeeKey == employeeKey).Select(e => e.Id).SingleAsync();

    private static async Task<PeopleProfileDto> ProfileAsync(
        CoreHRDbContext db, OrganizationService organization, string employeeKey, DateTime? asOf = null)
    {
        var result = await new PeopleProfileQueryHandler(db, organization, new PeopleTimelineComposer(db))
            .Handle(new PeopleProfileQuery(employeeKey, asOf), default);
        if (result.IsFailure) throw new InvalidOperationException(result.Error.Message);
        return result.Value;
    }

    private static CoreHRDbContext CreateDb(string connectionString, Guid tenantId)
        => new(new DbContextOptionsBuilder<CoreHRDbContext>().UseNpgsql(connectionString).Options, TestTenantContext.WithTenant(tenantId));

    private static async Task CreateDatabaseAsync(string baseConnectionString, string databaseName)
    {
        var adminConnection = new NpgsqlConnectionStringBuilder(baseConnectionString) { Database = "postgres", Pooling = false }.ConnectionString;
        await using var connection = new NpgsqlConnection(adminConnection);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"CREATE DATABASE \"{databaseName}\"", connection);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task DropDatabaseAsync(string baseConnectionString, string databaseName)
    {
        var adminConnection = new NpgsqlConnectionStringBuilder(baseConnectionString) { Database = "postgres", Pooling = false }.ConnectionString;
        await using var connection = new NpgsqlConnection(adminConnection);
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
