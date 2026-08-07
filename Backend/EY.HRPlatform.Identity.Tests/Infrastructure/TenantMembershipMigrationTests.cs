using EY.HRPlatform.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace EY.HRPlatform.Identity.Tests.Infrastructure;

/// <summary>
/// Migration tests for the membership cutover. These need a real PostgreSQL
/// server because the invariants under test are filtered unique indexes,
/// composite foreign keys, and a trigger — none of which the in-memory provider
/// can enforce.
///
/// Point <c>ConnectionStrings__IdentityDb</c> (or <c>FUSION_TEST_PG</c>) at a
/// server the suite may create scratch databases on. Without one the tests skip
/// rather than pass vacuously.
/// </summary>
public sealed class TenantMembershipMigrationTests : IAsyncLifetime
{
    private static readonly Guid TenantA = new("aaaaaaaa-0000-0000-0000-00000000000a");
    private static readonly Guid TenantB = new("bbbbbbbb-0000-0000-0000-00000000000b");

    private string? _adminConnectionString;
    private readonly List<string> _scratchDatabases = [];

    private bool Available => _adminConnectionString is not null;

    public Task InitializeAsync()
    {
        var configured = Environment.GetEnvironmentVariable("FUSION_TEST_PG")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");

        if (!string.IsNullOrWhiteSpace(configured))
        {
            _adminConnectionString = configured;
        }

        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        if (!Available)
        {
            return;
        }

        foreach (var database in _scratchDatabases)
        {
            await DropScratchDatabaseAsync(database);
        }
    }

    [SkippableFact]
    public async Task Fresh_database_creation_applies_every_migration()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");

        await using var dbContext = await CreateMigratedScratchAsync();

        var applied = await dbContext.Database.GetAppliedMigrationsAsync();
        Assert.Contains(applied, name => name.EndsWith("AddTenantMembershipAndBootstrapPersistence", StringComparison.Ordinal));

        // A fresh database starts with no invented tenancy.
        Assert.Empty(await dbContext.TenantMemberships.IgnoreQueryFilters().ToListAsync());
        Assert.Empty(await dbContext.TenantModuleEntitlements.IgnoreQueryFilters().ToListAsync());
    }

    [SkippableFact]
    public async Task Valid_source_backfills_exactly_one_membership_per_eligible_account()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");

        await using var dbContext = await CreateScratchAtPreCutoverAsync();

        await SeedTenantAsync(dbContext, TenantA);
        var ordinary = await SeedAccountAsync(dbContext, TenantA, "member@example.com");
        var platformAdmin = await SeedAccountAsync(dbContext, TenantA, "platform@example.com");
        await GrantPlatformAdminRoleAsync(dbContext, platformAdmin);

        await MigrateToLatestAsync(dbContext);

        var memberships = await dbContext.TenantMemberships.IgnoreQueryFilters().ToListAsync();

        var membership = Assert.Single(memberships);
        Assert.Equal(ordinary, membership.UserId);
        Assert.Equal(TenantA, membership.TenantId);
        Assert.True(membership.IsActive);

        // The Platform Administrator receives no customer membership.
        Assert.DoesNotContain(memberships, m => m.UserId == platformAdmin);
    }

    [SkippableFact]
    public async Task Cutover_converges_on_the_same_result_from_equivalent_sources()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");

        // Determinism is proven by migrating two independent databases holding
        // equivalent legacy data and comparing the results. It cannot be proven by
        // a downgrade/re-upgrade cycle: removing account-owned tenancy is
        // deliberately irreversible, because a Platform Administrator has no tenant
        // to restore and inventing one would fabricate authority.
        await using var first = await CreateScratchAtPreCutoverAsync();
        await SeedTenantAsync(first, TenantA);
        await SeedAccountAsync(first, TenantA, "member@example.com");
        await SeedAccountAsync(first, TenantA, "second@example.com");
        await MigrateToLatestAsync(first);
        var firstSnapshot = await SnapshotAsync(first);

        await using var second = await CreateSecondScratchAtPreCutoverAsync();
        await SeedTenantAsync(second, TenantA);
        // Insertion order differs; the converted result must not.
        await SeedAccountAsync(second, TenantA, "second@example.com");
        await SeedAccountAsync(second, TenantA, "member@example.com");
        await MigrateToLatestAsync(second);
        var secondSnapshot = await SnapshotAsync(second);

        Assert.Equal(firstSnapshot, secondSnapshot);
    }

    [SkippableFact]
    public async Task Removing_account_owned_tenancy_is_irreversible()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");

        await using var dbContext = await CreateScratchAtPreCutoverAsync();
        await SeedTenantAsync(dbContext, TenantA);
        await SeedAccountAsync(dbContext, TenantA, "member@example.com");
        await MigrateToLatestAsync(dbContext);

        // Reverting must fail loudly rather than fabricate an all-zero tenant for
        // every account and quietly restore account-owned authority.
        var failure = await Assert.ThrowsAnyAsync<Exception>(
            () => MigrateToAsync(dbContext, "20260727015459_AddCanonicalSeedReceipt"));

        Assert.Contains("cannot be reverted", Flatten(failure), StringComparison.OrdinalIgnoreCase);
    }

    private static string Flatten(Exception exception)
    {
        var messages = new List<string>();
        for (var current = exception; current is not null; current = current.InnerException)
        {
            messages.Add(current.Message);
        }

        return string.Join(" | ", messages);
    }

    [SkippableFact]
    public async Task Account_referencing_a_missing_tenant_fails_the_migration()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");

        await using var dbContext = await CreateScratchAtPreCutoverAsync();
        await SeedTenantAsync(dbContext, TenantA);
        var accountId = await SeedAccountAsync(dbContext, TenantA, "orphan@example.com");

        // Break the tenant reference behind the foreign key.
        await dbContext.Database.ExecuteSqlRawAsync(
            """ALTER TABLE identity."AspNetUsers" DROP CONSTRAINT "FK_AspNetUsers_Tenants_TenantId";""");
        await dbContext.Database.ExecuteSqlRawAsync(
            $"""UPDATE identity."AspNetUsers" SET "TenantId" = '{TenantB}' WHERE "Id" = '{accountId}';""");

        var failure = await Assert.ThrowsAsync<PostgresException>(() => MigrateToLatestAsync(dbContext));

        Assert.Contains("reference tenants that do not exist", failure.MessageText, StringComparison.Ordinal);
        Assert.Contains(accountId.ToString(), failure.MessageText, StringComparison.OrdinalIgnoreCase);
    }

    [SkippableFact]
    public async Task Platform_administrator_holding_customer_access_fails_the_migration()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");

        await using var dbContext = await CreateScratchAtPreCutoverAsync();
        await SeedTenantAsync(dbContext, TenantA);
        var platformAdmin = await SeedAccountAsync(dbContext, TenantA, "platform@example.com");
        await GrantPlatformAdminRoleAsync(dbContext, platformAdmin);
        await SeedAccessAssignmentAsync(dbContext, TenantA, platformAdmin);

        var failure = await Assert.ThrowsAsync<PostgresException>(() => MigrateToLatestAsync(dbContext));

        Assert.Contains("Platform Administrator accounts hold customer access assignments", failure.MessageText, StringComparison.Ordinal);
    }

    [SkippableFact]
    public async Task Cross_tenant_access_assignment_fails_the_migration()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");

        await using var dbContext = await CreateScratchAtPreCutoverAsync();
        await SeedTenantAsync(dbContext, TenantA);
        await SeedTenantAsync(dbContext, TenantB);
        var accountId = await SeedAccountAsync(dbContext, TenantA, "member@example.com");

        // Assignment tenancy disagrees with account tenancy.
        await SeedAccessAssignmentAsync(dbContext, TenantB, accountId);

        var failure = await Assert.ThrowsAsync<PostgresException>(() => MigrateToLatestAsync(dbContext));

        Assert.Contains("contradict account tenancy", failure.MessageText, StringComparison.Ordinal);
    }

    [SkippableFact]
    public async Task Orgadmin_invitation_with_employee_link_is_preserved_as_workforce()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");

        await using var dbContext = await CreateScratchAtPreCutoverAsync();
        await SeedTenantAsync(dbContext, TenantA);
        var accountId = await SeedAccountAsync(dbContext, TenantA, "member@example.com");

        // The employee link positively identifies the workforce flow, so this
        // invitation must survive the migration with its purpose, credential, and
        // state intact rather than being treated as a retired bootstrap record.
        await dbContext.Database.ExecuteSqlRawAsync($"""
            INSERT INTO identity."InviteTokens"
                ("Id","Token","Email","TenantId","Role","ExpiresAt","CreatedAt","CreatedByUserId","EmployeeId","IsRevoked")
            VALUES (gen_random_uuid(), 'workforce-orgadmin-secret', 'lead@example.com', '{TenantA}', 'OrgAdmin',
                    now() + interval '7 days', now(), '{accountId}', gen_random_uuid(), false);
            """);

        await MigrateToLatestAsync(dbContext);

        var invitation = await dbContext.InviteTokens
            .IgnoreQueryFilters()
            .Select(i => new { i.Email, i.Purpose, i.Token, i.IsRevoked })
            .SingleAsync(i => i.Email == "lead@example.com");

        Assert.Equal(Identity.Domain.Enums.InvitationPurpose.WorkforceAccount, invitation.Purpose);
        Assert.Equal("workforce-orgadmin-secret", invitation.Token);
        Assert.False(invitation.IsRevoked);
    }

    [SkippableFact]
    public async Task Bootstrap_invitations_lose_their_raw_credential_and_workforce_invitations_keep_theirs()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");

        await using var dbContext = await CreateScratchAtPreCutoverAsync();
        await SeedTenantAsync(dbContext, TenantA);
        var accountId = await SeedAccountAsync(dbContext, TenantA, "member@example.com");

        // The bootstrap invitation is already revoked, which is what the operator
        // must do before migrating; a live one is a fail-fast case covered below.
        await dbContext.Database.ExecuteSqlRawAsync($"""
            INSERT INTO identity."InviteTokens"
                ("Id","Token","Email","TenantId","Role","ExpiresAt","CreatedAt","CreatedByUserId","IsRevoked","RevokedAt")
            VALUES
                (gen_random_uuid(), 'bootstrap-secret', 'admin@example.com', '{TenantA}', 'OrgAdmin',
                 now() + interval '7 days', now(), '{accountId}', true, now()),
                (gen_random_uuid(), 'workforce-secret', 'worker@example.com', '{TenantA}', 'Employee',
                 now() + interval '7 days', now(), '{accountId}', false, NULL);
            """);

        await MigrateToLatestAsync(dbContext);

        var rows = await dbContext.InviteTokens
            .IgnoreQueryFilters()
            .Select(i => new { i.Email, i.Purpose, i.Token, i.IsRevoked })
            .ToListAsync();

        var bootstrap = Assert.Single(rows, r => r.Email == "admin@example.com");
        Assert.Equal(Identity.Domain.Enums.InvitationPurpose.OrganizationBootstrap, bootstrap.Purpose);
        Assert.Null(bootstrap.Token);
        Assert.True(bootstrap.IsRevoked, "Retired bootstrap links must not remain activatable.");

        // The workforce invitation keeps its purpose, its credential, and its state.
        var workforce = Assert.Single(rows, r => r.Email == "worker@example.com");
        Assert.Equal(Identity.Domain.Enums.InvitationPurpose.WorkforceAccount, workforce.Purpose);
        Assert.Equal("workforce-secret", workforce.Token);
        Assert.False(workforce.IsRevoked);
    }

    [SkippableFact]
    public async Task Live_orgadmin_invitation_without_employee_link_fails_the_migration()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");

        await using var dbContext = await CreateScratchAtPreCutoverAsync();
        await SeedTenantAsync(dbContext, TenantA);
        var accountId = await SeedAccountAsync(dbContext, TenantA, "member@example.com");

        // Indistinguishable from a legitimate workforce OrgAdmin invitation, so it
        // must abort rather than be silently reclassified and have its credential
        // destroyed.
        await dbContext.Database.ExecuteSqlRawAsync($"""
            INSERT INTO identity."InviteTokens"
                ("Id","Token","Email","TenantId","Role","ExpiresAt","CreatedAt","CreatedByUserId","IsRevoked")
            VALUES (gen_random_uuid(), 'live-orgadmin-secret', 'lead@example.com', '{TenantA}', 'OrgAdmin',
                    now() + interval '7 days', now(), '{accountId}', false);
            """);

        var failure = await Assert.ThrowsAsync<PostgresException>(() => MigrateToLatestAsync(dbContext));

        Assert.Contains("cannot be distinguished from workforce invitations", failure.MessageText, StringComparison.Ordinal);
        Assert.Contains("lead@example.com", failure.MessageText, StringComparison.Ordinal);
    }

    [SkippableFact]
    public async Task Cross_tenant_access_profile_reference_fails_the_migration()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");

        await using var dbContext = await CreateScratchAtPreCutoverAsync();
        await SeedTenantAsync(dbContext, TenantA);
        await SeedTenantAsync(dbContext, TenantB);
        var accountId = await SeedAccountAsync(dbContext, TenantA, "member@example.com");

        // Profile belongs to tenant B while the assignment and account are tenant A.
        var profileId = Guid.NewGuid();
        var profileName = $"Foreign {profileId.ToString()[..8]}";
        await dbContext.Database.ExecuteSqlRawAsync($"""
            INSERT INTO identity."AccessProfiles"
                ("Id","TenantId","Name","NormalizedName","Description","Type","IsSystemProtected","CreatedAt")
            VALUES ('{profileId}', '{TenantB}', '{profileName}', '{profileName.ToUpperInvariant()}',
                    'test', 'SystemSeeded', true, now());
            """);
        await dbContext.Database.ExecuteSqlRawAsync($"""
            INSERT INTO identity."UserAccessProfiles" ("UserId","AccessProfileId","TenantId","CreatedAt")
            VALUES ('{accountId}', '{profileId}', '{TenantA}', now());
            """);

        var failure = await Assert.ThrowsAsync<PostgresException>(() => MigrateToLatestAsync(dbContext));

        Assert.Contains("cross-tenant access profiles", failure.MessageText, StringComparison.Ordinal);
    }

    [SkippableFact]
    public async Task Every_tenant_receives_the_mandatory_core_hr_entitlement()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");

        await using var dbContext = await CreateScratchAtPreCutoverAsync();
        await SeedTenantAsync(dbContext, TenantA);
        await SeedTenantAsync(dbContext, TenantB);

        await MigrateToLatestAsync(dbContext);

        var entitlements = await dbContext.TenantModuleEntitlements
            .IgnoreQueryFilters()
            .ToListAsync();

        foreach (var tenantId in new[] { TenantA, TenantB })
        {
            Assert.Contains(entitlements, e =>
                e.TenantId == tenantId && e.Module == Identity.Domain.Enums.TenantModule.CoreHR);
        }
    }

    // ---- scratch database plumbing -------------------------------------------------

    private string ScratchConnectionString(string databaseName)
    {
        var builder = new NpgsqlConnectionStringBuilder(_adminConnectionString)
        {
            Database = databaseName,
        };
        return builder.ConnectionString;
    }

    private async Task<AppIdentityDbContext> CreateMigratedScratchAsync()
    {
        var dbContext = await CreateScratchContextAsync();
        await dbContext.Database.MigrateAsync();
        return dbContext;
    }

    /// <summary>
    /// Builds a scratch database migrated to the state immediately before the
    /// cutover, so a test can seed realistic legacy data and then migrate.
    /// </summary>
    private async Task<AppIdentityDbContext> CreateScratchAtPreCutoverAsync()
    {
        var dbContext = await CreateScratchContextAsync();
        await MigrateToAsync(dbContext, "20260727015459_AddCanonicalSeedReceipt");
        return dbContext;
    }

    private Task<AppIdentityDbContext> CreateSecondScratchAtPreCutoverAsync()
        => CreateScratchAtPreCutoverAsync();

    private async Task<AppIdentityDbContext> CreateScratchContextAsync()
    {
        var databaseName = $"fusion_identity_test_{Guid.NewGuid():N}";
        await CreateScratchDatabaseAsync(databaseName);
        _scratchDatabases.Add(databaseName);

        var options = new DbContextOptionsBuilder<AppIdentityDbContext>()
            .UseNpgsql(ScratchConnectionString(databaseName))
            .Options;

        return new AppIdentityDbContext(options);
    }

    private async Task CreateScratchDatabaseAsync(string databaseName)
    {
        await using var connection = new NpgsqlConnection(AdminDatabaseConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"CREATE DATABASE \"{databaseName}\";";
        await command.ExecuteNonQueryAsync();
    }

    private async Task DropScratchDatabaseAsync(string databaseName)
    {
        NpgsqlConnection.ClearAllPools();

        await using var connection = new NpgsqlConnection(AdminDatabaseConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"DROP DATABASE IF EXISTS \"{databaseName}\" WITH (FORCE);";
        await command.ExecuteNonQueryAsync();
    }

    private string AdminDatabaseConnectionString()
    {
        var builder = new NpgsqlConnectionStringBuilder(_adminConnectionString)
        {
            Database = "postgres",
        };
        return builder.ConnectionString;
    }

    private static Task MigrateToLatestAsync(AppIdentityDbContext dbContext)
        => dbContext.Database.MigrateAsync();

    private static Task MigrateToAsync(AppIdentityDbContext dbContext, string targetMigration)
        => dbContext.GetService<IMigrator>().MigrateAsync(targetMigration);

    private static async Task<string> SnapshotAsync(AppIdentityDbContext dbContext)
    {
        // Identify the account by email rather than its randomly generated id, so
        // the snapshot compares the conversion itself and not incidental keys.
        var memberships = await dbContext.TenantMemberships
            .IgnoreQueryFilters()
            .Join(
                dbContext.Users.IgnoreQueryFilters(),
                membership => membership.UserId,
                user => user.Id,
                (membership, user) => new { user.Email, membership.TenantId, membership.Status })
            .OrderBy(row => row.Email).ThenBy(row => row.TenantId)
            .Select(row => $"{row.Email}:{row.TenantId}:{row.Status}")
            .ToListAsync();

        var entitlements = await dbContext.TenantModuleEntitlements
            .IgnoreQueryFilters()
            .OrderBy(e => e.TenantId).ThenBy(e => e.Module)
            .Select(e => $"{e.TenantId}:{e.Module}")
            .ToListAsync();

        return string.Join("|", memberships) + "||" + string.Join("|", entitlements);
    }

    // ---- legacy-shaped seeding -----------------------------------------------------

    private static Task SeedTenantAsync(AppIdentityDbContext dbContext, Guid tenantId)
        => dbContext.Database.ExecuteSqlRawAsync($"""
            INSERT INTO identity."Tenants" ("Id","Name","Slug","IsActive","IsArchived","CreatedAt")
            VALUES ('{tenantId}', 'Tenant {tenantId.ToString()[..8]}', '{tenantId.ToString()[..8]}', true, false, now());
            """);

    private static async Task<Guid> SeedAccountAsync(AppIdentityDbContext dbContext, Guid tenantId, string email)
    {
        var accountId = Guid.NewGuid();
        await dbContext.Database.ExecuteSqlRawAsync($"""
            INSERT INTO identity."AspNetUsers"
                ("Id","TenantId","FirstName","LastName","IsActive","CreatedAt","HireDate",
                 "UserName","NormalizedUserName","Email","NormalizedEmail","EmailConfirmed",
                 "PasswordHash","SecurityStamp","ConcurrencyStamp","PhoneNumberConfirmed",
                 "TwoFactorEnabled","LockoutEnabled","AccessFailedCount")
            VALUES ('{accountId}', '{tenantId}', 'Test', 'Account', true, now(), now(),
                    '{email}', '{email.ToUpperInvariant()}', '{email}', '{email.ToUpperInvariant()}', true,
                    'hash', '{Guid.NewGuid()}', '{Guid.NewGuid()}', false, false, true, 0);
            """);
        return accountId;
    }

    private static async Task GrantPlatformAdminRoleAsync(AppIdentityDbContext dbContext, Guid accountId)
    {
        var roleId = Guid.NewGuid();
        await dbContext.Database.ExecuteSqlRawAsync($"""
            INSERT INTO identity."AspNetRoles" ("Id","Name","NormalizedName","ConcurrencyStamp")
            SELECT '{roleId}', 'PlatformAdmin', 'PLATFORMADMIN', '{Guid.NewGuid()}'
            WHERE NOT EXISTS (SELECT 1 FROM identity."AspNetRoles" WHERE "NormalizedName" = 'PLATFORMADMIN');
            """);

        await dbContext.Database.ExecuteSqlRawAsync($"""
            INSERT INTO identity."AspNetUserRoles" ("UserId","RoleId")
            SELECT '{accountId}', "Id" FROM identity."AspNetRoles" WHERE "NormalizedName" = 'PLATFORMADMIN';
            """);
    }

    private static async Task SeedAccessAssignmentAsync(AppIdentityDbContext dbContext, Guid tenantId, Guid accountId)
    {
        var profileId = Guid.NewGuid();

        // Seeded as the administrator profile a real tenant of this era carried.
        // Anonymising the name would describe a tenant with members and no
        // identifiable administrator, which the canonical-authority migration
        // deliberately refuses to convert.
        const string profileName = "Org Admin";
        await dbContext.Database.ExecuteSqlRawAsync($"""
            INSERT INTO identity."AccessProfiles"
                ("Id","TenantId","Name","NormalizedName","Description","Type","IsSystemProtected","InternalKey","CreatedAt")
            VALUES ('{profileId}', '{tenantId}', '{profileName}', '{profileName.ToUpperInvariant()}',
                    'test', 'SystemSeeded', true, 'org-admin', now());
            """);

        await dbContext.Database.ExecuteSqlRawAsync($"""
            INSERT INTO identity."UserAccessProfiles" ("UserId","AccessProfileId","TenantId","CreatedAt")
            VALUES ('{accountId}', '{profileId}', '{tenantId}', now());
            """);
    }
}
