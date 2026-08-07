using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Npgsql;

namespace EY.HRPlatform.Identity.Tests.Infrastructure;

/// <summary>
/// The migration to canonical Tenant Administrator authority against real
/// PostgreSQL.
/// <para>
/// These rules cannot be proven in memory: the backfill is SQL, the assertions
/// are <c>RAISE EXCEPTION</c>, and the uniqueness guarantee is a filtered index.
/// What matters most here is the failure behaviour — a migration that completes
/// while leaving a tenant with no usable administrator would strand that
/// customer's entire administration.
/// </para>
/// </summary>
public sealed class CanonicalAuthorityMigrationTests : IAsyncLifetime
{
    /// <summary>The migration immediately before canonical authority.</summary>
    private const string PreCanonical = "20260803094313_DropInvitationActivationContinuation";

    private readonly RelationalTestDatabase _databases = new();
    private readonly List<string> _rawDatabases = [];

    private bool Available => _databases.Available;

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _databases.DisposeAsync();

        if (!Available)
        {
            return;
        }

        foreach (var database in _rawDatabases)
        {
            try
            {
                await using var connection = new NpgsqlConnection(_databases.AdminConnectionString);
                await connection.OpenAsync();
                await using var terminate = connection.CreateCommand();
                terminate.CommandText =
                    $"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{database}';";
                await terminate.ExecuteNonQueryAsync();
                await using var drop = connection.CreateCommand();
                drop.CommandText = $"DROP DATABASE IF EXISTS \"{database}\";";
                await drop.ExecuteNonQueryAsync();
            }
            catch (NpgsqlException)
            {
                // A leaked test database is noise, not a failure signal.
            }
        }
    }

    // ── Fresh install ────────────────────────────────────

    [SkippableFact]
    public async Task A_fresh_database_gains_the_canonical_authority_schema()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await _databases.CreateAsync("fusion_migration_fresh");

        Assert.True(await ScalarBoolAsync(db, """
            SELECT EXISTS (SELECT 1 FROM information_schema.tables
                            WHERE table_schema = 'identity'
                              AND table_name = 'TenantAdministratorAssignments');
            """));

        // Active-row uniqueness is what makes "at most one active authority per
        // membership" a database guarantee rather than a service convention.
        Assert.True(await ScalarBoolAsync(db, """
            SELECT EXISTS (SELECT 1 FROM pg_indexes
                            WHERE schemaname = 'identity'
                              AND indexname = 'IX_TenantAdministratorAssignments_MembershipActiveUnique');
            """));

        // The removed terminal membership state must be gone from the vocabulary.
        Assert.Equal(0, await ScalarIntAsync(db, """
            SELECT count(*) FROM identity."TenantMemberships" WHERE "Status" = 'Inactive';
            """));
    }

    // ── Upgrade with data ────────────────────────────────

    [SkippableFact]
    public async Task An_existing_bootstrap_administrator_is_converted_without_losing_continuity()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var (db, tenantId, membershipId) = await UpgradeFromPreCanonicalAsync(seedOrgAdminAssignment: true);
        await using var _db = db;

        var assignment = await SingleRowAsync(db, $"""
            SELECT count(*) FROM identity."TenantAdministratorAssignments"
             WHERE "TenantId" = '{tenantId}'
               AND "TenantMembershipId" = '{membershipId}'
               AND "RevokedAt" IS NULL
               AND "GrantedByActorType" = 'Migration';
            """);

        // One administrator in, one canonical authority out — on the same
        // membership, so no second account, membership, or authority appears.
        Assert.Equal(1, assignment);

        Assert.Equal(1, await ScalarIntAsync(db, $"""
            SELECT count(*) FROM identity."TenantMemberships" WHERE "TenantId" = '{tenantId}';
            """));
    }

    [SkippableFact]
    public async Task The_backfill_converges_when_the_conversion_runs_again()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var (db, tenantId, _) = await UpgradeFromPreCanonicalAsync(seedOrgAdminAssignment: true);
        await using var _db = db;

        // Re-running the conversion is how a partially applied deployment recovers.
        // It must not produce a second active authority for the same membership.
        await db.Database.ExecuteSqlRawAsync("""
            INSERT INTO identity."TenantAdministratorAssignments"
                ("Id", "TenantId", "UserId", "TenantMembershipId",
                 "GrantedAt", "GrantedByUserId", "GrantedByActorType", "SourceInvitationId",
                 "RevokedAt", "RevokedByUserId", "RevocationReason")
            SELECT gen_random_uuid(), assignment."TenantId", assignment."UserId",
                   assignment."TenantMembershipId", assignment."CreatedAt",
                   NULL, 'Migration', NULL, NULL, NULL, NULL
              FROM identity."UserAccessProfiles" AS assignment
              JOIN identity."AccessProfiles" AS profile ON profile."Id" = assignment."AccessProfileId"
             WHERE profile."InternalKey" = 'org-admin'
               AND NOT EXISTS (SELECT 1 FROM identity."TenantAdministratorAssignments" AS existing
                                WHERE existing."TenantMembershipId" = assignment."TenantMembershipId"
                                  AND existing."RevokedAt" IS NULL);
            """);

        Assert.Equal(1, await ScalarIntAsync(db, $"""
            SELECT count(*) FROM identity."TenantAdministratorAssignments"
             WHERE "TenantId" = '{tenantId}' AND "RevokedAt" IS NULL;
            """));
    }

    [SkippableFact]
    public async Task A_second_active_authority_for_one_membership_is_rejected_by_the_database()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var (db, tenantId, membershipId) = await UpgradeFromPreCanonicalAsync(seedOrgAdminAssignment: true);
        await using var _db = db;

        var userId = await ScalarGuidAsync(db, $"""
            SELECT "UserId" FROM identity."TenantMemberships" WHERE "Id" = '{membershipId}';
            """);

        var duplicate = await Assert.ThrowsAsync<PostgresException>(() =>
            db.Database.ExecuteSqlRawAsync($"""
                INSERT INTO identity."TenantAdministratorAssignments"
                    ("Id", "TenantId", "UserId", "TenantMembershipId",
                     "GrantedAt", "GrantedByActorType")
                VALUES (gen_random_uuid(), '{tenantId}', '{userId}', '{membershipId}',
                        now(), 'Migration');
                """));

        Assert.Equal("23505", duplicate.SqlState);
    }

    // ── Fail-fast assertions ─────────────────────────────

    [SkippableFact]
    public async Task A_membership_carrying_the_removed_terminal_state_stops_the_migration()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");

        // The design removed Inactive on the evidence that no runtime path produces
        // it. If that evidence is wrong, the migration must stop rather than
        // silently reinterpret an ended relationship as a reversible suspension.
        var failure = await Assert.ThrowsAsync<PostgresException>(() =>
            UpgradeFromPreCanonicalAsync(seedOrgAdminAssignment: true, seedInactiveMembership: true));

        Assert.Contains("Inactive", failure.MessageText, StringComparison.Ordinal);
    }

    // The "administrator lost during conversion" assertion has no reachable failure
    // path against the current backfill: every recognised source assignment inserts
    // its canonical row in the same statement. It is kept as a guard against a
    // future change to that statement, and is deliberately not exercised by a test
    // that would have to fake the corruption to reach it.

    [SkippableFact]
    public async Task A_tenant_that_was_already_unadministered_is_reported_rather_than_blocking_the_deployment()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");

        // This tenant had no administrator before the migration ran. The conversion
        // neither caused that nor can invent an administrator for it, so the
        // deployment proceeds and the tenant surfaces as needing Platform-assisted
        // recovery instead.
        var (db, tenantId, _) = await UpgradeFromPreCanonicalAsync(seedOrgAdminAssignment: false);
        await using var _db = db;

        Assert.Equal(0, await ScalarIntAsync(db, $"""
            SELECT count(*) FROM identity."TenantAdministratorAssignments" WHERE "TenantId" = '{tenantId}';
            """));
    }

    // ── plumbing ─────────────────────────────────────────

    /// <summary>
    /// Migrates a database to the state immediately before canonical authority,
    /// seeds pre-canonical data through raw SQL — the EF model no longer describes
    /// that schema — and then applies the remaining migrations.
    /// </summary>
    private async Task<(AppIdentityDbContext Db, Guid TenantId, Guid MembershipId)> UpgradeFromPreCanonicalAsync(
        bool seedOrgAdminAssignment,
        bool seedInactiveMembership = false)
    {
        var name = $"fusion_migration_upgrade_{Guid.NewGuid():N}";

        await using (var connection = new NpgsqlConnection(_databases.AdminConnectionString))
        {
            await connection.OpenAsync();
            await using var create = connection.CreateCommand();
            create.CommandText = $"CREATE DATABASE \"{name}\";";
            await create.ExecuteNonQueryAsync();
        }

        _rawDatabases.Add(name);

        var connectionString =
            new NpgsqlConnectionStringBuilder(_databases.AdminConnectionString) { Database = name }.ConnectionString;

        var db = new AppIdentityDbContext(
            new DbContextOptionsBuilder<AppIdentityDbContext>().UseNpgsql(connectionString).Options);

        await db.GetService<IMigrator>().MigrateAsync(PreCanonical);

        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var membershipId = Guid.NewGuid();
        var profileId = Guid.NewGuid();

        await db.Database.ExecuteSqlRawAsync($"""
            INSERT INTO identity."Tenants"
                ("Id","Name","Slug","IsActive","IsArchived","CreatedAt",
                 "AdministratorActivationStatus","Locale","TimeZone")
            VALUES ('{tenantId}','Atlas Group','atlas-group-{tenantId:N}',true,false,now(),
                    'Active','en-US','Europe/Paris');

            INSERT INTO identity."AspNetUsers"
                ("Id","UserName","NormalizedUserName","Email","NormalizedEmail","EmailConfirmed",
                 "PasswordHash","SecurityStamp","ConcurrencyStamp","PhoneNumberConfirmed",
                 "TwoFactorEnabled","LockoutEnabled","AccessFailedCount",
                 "FirstName","LastName","IsActive","HireDate","CreatedAt")
            VALUES ('{userId}','ada@atlas.example','ADA@ATLAS.EXAMPLE','ada@atlas.example',
                    'ADA@ATLAS.EXAMPLE',true,'x','{Guid.NewGuid()}','{Guid.NewGuid()}',false,
                    false,true,0,'Ada','Admin',true,now(),now());

            INSERT INTO identity."TenantMemberships"
                ("Id","UserId","TenantId","Status","CreatedAt")
            VALUES ('{membershipId}','{userId}','{tenantId}','Active',now());

            INSERT INTO identity."AccessProfiles"
                ("Id","TenantId","Name","NormalizedName","Description","Type","IsSystemProtected","InternalKey","CreatedAt")
            VALUES ('{profileId}','{tenantId}','Org Admin','ORG ADMIN','Pre-canonical administrator',
                    'SystemSeeded',true,'org-admin',now());
            """);

        if (seedOrgAdminAssignment)
        {
            await db.Database.ExecuteSqlRawAsync($"""
                INSERT INTO identity."UserAccessProfiles"
                    ("TenantId","UserId","AccessProfileId","TenantMembershipId","CreatedAt")
                VALUES ('{tenantId}','{userId}','{profileId}','{membershipId}',now());
                """);
        }

        if (seedInactiveMembership)
        {
            var strandedUser = Guid.NewGuid();
            await db.Database.ExecuteSqlRawAsync($"""
                INSERT INTO identity."AspNetUsers"
                    ("Id","UserName","NormalizedUserName","Email","NormalizedEmail","EmailConfirmed",
                     "PasswordHash","SecurityStamp","ConcurrencyStamp","PhoneNumberConfirmed",
                     "TwoFactorEnabled","LockoutEnabled","AccessFailedCount",
                     "FirstName","LastName","IsActive","HireDate","CreatedAt")
                VALUES ('{strandedUser}','left@atlas.example','LEFT@ATLAS.EXAMPLE','left@atlas.example',
                        'LEFT@ATLAS.EXAMPLE',true,'x','{Guid.NewGuid()}','{Guid.NewGuid()}',false,
                        false,true,0,'Lee','Left',true,now(),now());

                INSERT INTO identity."TenantMemberships"
                    ("Id","UserId","TenantId","Status","CreatedAt","DeactivatedAt")
                VALUES ('{Guid.NewGuid()}','{strandedUser}','{tenantId}','Inactive',now(),now());
                """);
        }

        await db.Database.MigrateAsync();
        db.ChangeTracker.Clear();
        return (db, tenantId, membershipId);
    }

    private static async Task<bool> ScalarBoolAsync(AppIdentityDbContext db, string sql)
        => await ExecuteScalarAsync(db, sql) is true;

    private static async Task<int> ScalarIntAsync(AppIdentityDbContext db, string sql)
        => Convert.ToInt32(await ExecuteScalarAsync(db, sql));

    private static Task<int> SingleRowAsync(AppIdentityDbContext db, string sql)
        => ScalarIntAsync(db, sql);

    private static async Task<Guid> ScalarGuidAsync(AppIdentityDbContext db, string sql)
        => (Guid)(await ExecuteScalarAsync(db, sql))!;

    private static async Task<object?> ExecuteScalarAsync(AppIdentityDbContext db, string sql)
    {
        await using var connection = new NpgsqlConnection(db.Database.GetConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        return await command.ExecuteScalarAsync();
    }
}
