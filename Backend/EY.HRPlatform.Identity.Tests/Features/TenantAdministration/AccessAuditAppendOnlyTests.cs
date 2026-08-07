using EY.HRPlatform.Identity.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EY.HRPlatform.Identity.Tests.Features.TenantAdministration;

/// <summary>
/// Access audit is append-only as a property of the database, not as a promise
/// from the service.
/// <para>
/// This has to be proven against a real connection as the role the service uses.
/// The application code never issues an UPDATE or DELETE against the audit table,
/// so no unit test can distinguish "we do not rewrite evidence" from "we cannot".
/// The distinction is the whole point: the guarantee has to survive a defect or a
/// compromised application principal.
/// </para>
/// </summary>
public sealed class AccessAuditAppendOnlyTests : IAsyncLifetime
{
    private readonly RelationalTestDatabase _databases = new();
    private bool Available => _databases.Available;

    public Task InitializeAsync() => Task.CompletedTask;

    public Task DisposeAsync() => _databases.DisposeAsync().AsTask();

    [SkippableFact]
    public async Task A_non_superuser_runtime_role_cannot_rewrite_or_erase_audit()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");

        var db = await _databases.CreateAsync("fusion_audit_appendonly");
        var database = db.Database.GetDbConnection().Database;
        var role = $"fusion_runtime_{Guid.NewGuid():N}"[..32];

        // The role the service would connect as: able to work, not able to
        // rewrite history.
        await ExecuteAsync(db, $"""
            CREATE ROLE "{role}" LOGIN PASSWORD 'probe-only';
            GRANT USAGE ON SCHEMA identity TO "{role}";
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA identity TO "{role}";
            """);

        try
        {
            await ExecuteAsync(db, $"""
                DO $$
                DECLARE
                    still_writable boolean;
                BEGIN
                    EXECUTE format(
                        'REVOKE UPDATE, DELETE ON identity."AccessAuditEvents" FROM %I', '{role}');

                    SELECT has_table_privilege('{role}', 'identity."AccessAuditEvents"', 'UPDATE')
                        OR has_table_privilege('{role}', 'identity."AccessAuditEvents"', 'DELETE')
                      INTO still_writable;

                    IF still_writable THEN
                        RAISE EXCEPTION 'Append-only enforcement did not apply to %', '{role}';
                    END IF;
                END $$;
                """);

            var builder = new NpgsqlConnectionStringBuilder(_databases.AdminConnectionString)
            {
                Database = database,
                Username = role,
                Password = "probe-only",
            };

            await using var asRuntime = new NpgsqlConnection(builder.ConnectionString);
            await asRuntime.OpenAsync();

            // Reading and appending stay available; the service still has to work.
            await RunAsync(asRuntime, "SELECT 1 FROM identity.\"AccessAuditEvents\" LIMIT 1;");

            var update = await Assert.ThrowsAsync<PostgresException>(() =>
                RunAsync(asRuntime, "UPDATE identity.\"AccessAuditEvents\" SET \"Summary\" = 'tampered';"));
            Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, update.SqlState);

            var delete = await Assert.ThrowsAsync<PostgresException>(() =>
                RunAsync(asRuntime, "DELETE FROM identity.\"AccessAuditEvents\";"));
            Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, delete.SqlState);
        }
        finally
        {
            await ExecuteAsync(db, $"""
                REVOKE ALL ON ALL TABLES IN SCHEMA identity FROM "{role}";
                REVOKE ALL ON SCHEMA identity FROM "{role}";
                DROP ROLE IF EXISTS "{role}";
                """);
        }
    }

    private static Task ExecuteAsync(DbContext db, string sql)
        => db.Database.ExecuteSqlRawAsync(sql);

    private static async Task RunAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync();
    }
}
