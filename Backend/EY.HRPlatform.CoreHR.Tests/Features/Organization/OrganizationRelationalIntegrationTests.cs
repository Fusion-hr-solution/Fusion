using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EY.HRPlatform.CoreHR.Tests.Features.Organization;

/// <summary>
/// Opt-in relational coverage. Set FUSION_COREHR_RELATIONAL_TEST_CONNECTION to a
/// disposable PostgreSQL connection string to exercise the actual EF migrations.
/// </summary>
public sealed class OrganizationRelationalIntegrationTests
{
    [RelationalDatabaseFact]
    public async Task Canonical_organization_persists_and_is_tenant_isolated_after_a_clean_migration()
    {
        var baseConnectionString = Environment.GetEnvironmentVariable("FUSION_COREHR_RELATIONAL_TEST_CONNECTION")!;
        var databaseName = $"fusion_corehr_org_{Guid.NewGuid():N}";
        var connectionString = new NpgsqlConnectionStringBuilder(baseConnectionString)
        {
            Database = databaseName,
            Pooling = false,
        }.ConnectionString;

        try
        {
            await CreateDatabaseAsync(baseConnectionString, databaseName);

            var tenantA = Guid.NewGuid();
            var tenantB = Guid.NewGuid();
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var future = today.AddDays(7);

            await using (var tenantADb = CreateDb(connectionString, tenantA))
            {
                await tenantADb.Database.MigrateAsync();
                var organization = new OrganizationService(tenantADb, TestTenantContext.WithTenant(tenantA));
                await organization.GetTypesAsync(default);

                var root = await organization.CreateRootAsync(
                    new CreateOrganizationRootRequest("ORG", "Fusion", today), default);
                var unit = await organization.CreateUnitAsync(
                    new CreateOrganizationUnitRequest("TECH", "Technology", OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default);

                await organization.ChangeAsync(
                    unit.Id,
                    unit.Version,
                    new ChangeOrganizationUnitRequest("Engineering", null, future, "Rename"),
                    default);

                var upcoming = await organization.GetUpcomingChangesAsync(default);
                Assert.Single(upcoming, change => change.OrgUnitId == unit.Id);
                Assert.Equal(3, await tenantADb.OrgUnitEffectiveStates.CountAsync());
                Assert.Equal(3, await tenantADb.OrgUnitEffectiveStates.IgnoreQueryFilters().CountAsync(state => state.TenantId == tenantA));

                await Assert.ThrowsAsync<DuplicateEntityException>(() => organization.CreateUnitAsync(
                    new CreateOrganizationUnitRequest("TECH", "Duplicate code", OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default));
            }

            await using (var tenantBDb = CreateDb(connectionString, tenantB))
            {
                var organization = new OrganizationService(tenantBDb, TestTenantContext.WithTenant(tenantB));
                Assert.Empty((await organization.GetHierarchyAsync(today, default)).Roots);
                Assert.Empty(await tenantBDb.OrgUnits.ToListAsync());
                Assert.Empty(await tenantBDb.OrganizationChanges.ToListAsync());
            }
        }
        finally
        {
            await DropDatabaseAsync(baseConnectionString, databaseName);
        }
    }

    private static CoreHRDbContext CreateDb(string connectionString, Guid tenantId)
        => new(
            new DbContextOptionsBuilder<CoreHRDbContext>().UseNpgsql(connectionString).Options,
            TestTenantContext.WithTenant(tenantId));

    private static async Task CreateDatabaseAsync(string baseConnectionString, string databaseName)
    {
        var adminConnectionString = new NpgsqlConnectionStringBuilder(baseConnectionString)
        {
            Database = "postgres",
            Pooling = false,
        }.ConnectionString;
        await using var connection = new NpgsqlConnection(adminConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"CREATE DATABASE \"{databaseName}\"", connection);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task DropDatabaseAsync(string baseConnectionString, string databaseName)
    {
        var adminConnectionString = new NpgsqlConnectionStringBuilder(baseConnectionString)
        {
            Database = "postgres",
            Pooling = false,
        }.ConnectionString;
        await using var connection = new NpgsqlConnection(adminConnectionString);
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

[AttributeUsage(AttributeTargets.Method)]
internal sealed class RelationalDatabaseFactAttribute : FactAttribute
{
    public RelationalDatabaseFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("FUSION_COREHR_RELATIONAL_TEST_CONNECTION")))
            Skip = "Set FUSION_COREHR_RELATIONAL_TEST_CONNECTION to run PostgreSQL integration coverage.";
    }
}
