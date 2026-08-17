using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.Features.Organization;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EY.HRPlatform.CoreHR.Tests.Features.Workforce;

public sealed class WorkforceFoundationRelationalTests
{
    [RelationalDatabaseFact]
    public async Task TenantAllocator_SerializesConcurrentRequests_AndRollsBackWithItsTransaction()
    {
        var (baseConnection, databaseName, connectionString) = Connection("allocator");
        try
        {
            await CreateDatabaseAsync(baseConnection, databaseName);
            var tenantId = Guid.NewGuid();
            await using (var migrated = CreateDb(connectionString, tenantId))
                await migrated.Database.MigrateAsync();

            var allocations = await Task.WhenAll(
                AllocateAndCommitAsync(connectionString, tenantId),
                AllocateAndCommitAsync(connectionString, tenantId));

            Assert.Equal(2, allocations.Distinct(StringComparer.Ordinal).Count());
            Assert.Equal(["EMP-00000001", "EMP-00000002"], allocations.Order(StringComparer.Ordinal).ToArray());

            await using (var rollbackDb = CreateDb(connectionString, tenantId))
            await using (var transaction = await rollbackDb.Database.BeginTransactionAsync())
            {
                var rolledBack = await new EmployeeNumberAllocatorService(
                    rollbackDb, TestTenantContext.WithTenant(tenantId)).AllocateAsync();
                Assert.Equal("EMP-00000003", rolledBack);
                await rollbackDb.SaveChangesAsync();
                await transaction.RollbackAsync();
            }

            Assert.Equal(
                "EMP-00000003",
                await AllocateAndCommitAsync(connectionString, tenantId));
        }
        finally
        {
            await DropDatabaseAsync(baseConnection, databaseName);
        }
    }

    [RelationalDatabaseFact]
    public async Task Occupancy_ReleasesOnEnd_ReacquiresOnStart_AndMovesWithEmail()
    {
        var (baseConnection, databaseName, connectionString) = Connection("occupancy");
        try
        {
            await CreateDatabaseAsync(baseConnection, databaseName);
            var tenantId = Guid.NewGuid();
            await using var db = CreateDb(connectionString, tenantId);
            await db.Database.MigrateAsync();
            var tenant = TestTenantContext.WithTenant(tenantId);
            var resolver = new WorkforceCanonicalResolver(db);
            var mutation = new WorkforceMutationService(db, tenant, resolver);

            var first = Employee.Create(
                tenantId, "First", "Employee", "shared@example.com", employeeNumber: "EMP-A");
            db.Employees.Add(first);
            Assert.True((await mutation.StartEmploymentAsync(
                first.Id, new StartEmploymentInput(DateTime.UtcNow.Date, null), null, default)).IsSuccess);
            await db.SaveChangesAsync();
            Assert.Equal(first.Id, await db.WorkEmailOccupancies.Select(x => x.EmployeeId).SingleAsync());

            Assert.True((await mutation.EndEmploymentAsync(
                first.Id, DateTime.UtcNow.Date.AddDays(1), null, default)).IsSuccess);
            await db.SaveChangesAsync();
            Assert.Empty(await db.WorkEmailOccupancies.ToListAsync());

            var second = Employee.Create(
                tenantId, "Second", "Employee", "shared@example.com", employeeNumber: "EMP-B");
            db.Employees.Add(second);
            Assert.True((await mutation.StartEmploymentAsync(
                second.Id, new StartEmploymentInput(DateTime.UtcNow.Date, null), null, default)).IsSuccess);
            await db.SaveChangesAsync();

            var rehireConflict = await mutation.StartEmploymentAsync(
                first.Id, new StartEmploymentInput(DateTime.UtcNow.Date.AddDays(2), null), null, default);
            Assert.True(rehireConflict.IsFailure);
            Assert.Equal("Employee.EmailOccupied", rehireConflict.Error.Code);
            db.ChangeTracker.Clear();

            second = await db.Employees.SingleAsync(x => x.Id == second.Id);
            var moved = await new WorkforceMutationService(db, tenant, new WorkforceCanonicalResolver(db))
                .UpdateEmployeeProfileAsync(
                    second.Id,
                    new UpdateEmployeeProfileInput("Second", "Employee", "moved@example.com", null, null),
                    null,
                    default);
            Assert.True(moved.IsSuccess);
            await db.SaveChangesAsync();

            var occupancy = await db.WorkEmailOccupancies.SingleAsync();
            Assert.Equal(second.Id, occupancy.EmployeeId);
            Assert.Equal("moved@example.com", occupancy.NormalizedEmail);
        }
        finally
        {
            await DropDatabaseAsync(baseConnection, databaseName);
        }
    }

    private static async Task<string> AllocateAndCommitAsync(string connectionString, Guid tenantId)
    {
        await using var db = CreateDb(connectionString, tenantId);
        await using var transaction = await db.Database.BeginTransactionAsync();
        var value = await new EmployeeNumberAllocatorService(
            db, TestTenantContext.WithTenant(tenantId)).AllocateAsync();
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return value;
    }

    private static (string Base, string Name, string Connection) Connection(string suffix)
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_COREHR_RELATIONAL_TEST_CONNECTION")!;
        var name = $"fusion_corehr_workforce_{suffix}_{Guid.NewGuid():N}";
        var connection = new NpgsqlConnectionStringBuilder(baseConnection)
        {
            Database = name,
            Pooling = false,
        }.ConnectionString;
        return (baseConnection, name, connection);
    }

    private static CoreHRDbContext CreateDb(string connectionString, Guid tenantId)
        => new(
            new DbContextOptionsBuilder<CoreHRDbContext>().UseNpgsql(connectionString).Options,
            TestTenantContext.WithTenant(tenantId));

    private static async Task CreateDatabaseAsync(string baseConnectionString, string databaseName)
    {
        var admin = new NpgsqlConnectionStringBuilder(baseConnectionString)
        {
            Database = "postgres",
            Pooling = false,
        }.ConnectionString;
        await using var connection = new NpgsqlConnection(admin);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"CREATE DATABASE \"{databaseName}\"", connection);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task DropDatabaseAsync(string baseConnectionString, string databaseName)
    {
        if (string.IsNullOrWhiteSpace(baseConnectionString)) return;
        var admin = new NpgsqlConnectionStringBuilder(baseConnectionString)
        {
            Database = "postgres",
            Pooling = false,
        }.ConnectionString;
        await using var connection = new NpgsqlConnection(admin);
        await connection.OpenAsync();
        await using (var terminate = new NpgsqlCommand(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = @name AND pid <> pg_backend_pid();",
            connection))
        {
            terminate.Parameters.AddWithValue("name", databaseName);
            await terminate.ExecuteNonQueryAsync();
        }
        await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{databaseName}\"", connection);
        await drop.ExecuteNonQueryAsync();
    }
}
