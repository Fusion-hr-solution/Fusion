using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;

namespace EY.HRPlatform.Identity.Tests.TestHelpers;

/// <summary>
/// Throwaway PostgreSQL databases for the rules that only a real database can
/// prove: row locking, filtered unique indexes, transactional rollback, and
/// concurrent commands racing for the same tenant.
/// <para>
/// Each database is created fresh and migrated, so every test also exercises the
/// migration path from empty schema forward.
/// </para>
/// </summary>
public sealed class RelationalTestDatabase : IAsyncDisposable
{
    private readonly List<string> _databases = [];
    private readonly List<AppIdentityDbContext> _contexts = [];

    public string? AdminConnectionString { get; }

    public bool Available => AdminConnectionString is not null;

    /// <summary>
    /// Set <c>FUSION_TEST_REQUIRE_PG=true</c> in CI so a missing database fails the
    /// run instead of skipping it.
    /// <para>
    /// Without this, the guarantees that only a real database can prove — row
    /// locking, filtered unique indexes, transactional rollback, migrations,
    /// concurrent commands — quietly do not run, and the suite still reports
    /// green. A green run that proved none of them is worse than a red one.
    /// </para>
    /// </summary>
    private const string RequireDatabaseVariable = "FUSION_TEST_REQUIRE_PG";

    public RelationalTestDatabase()
    {
        var configured = Environment.GetEnvironmentVariable("FUSION_TEST_PG")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");

        if (!string.IsNullOrWhiteSpace(configured))
        {
            AdminConnectionString = configured;
            return;
        }

        if (string.Equals(
                Environment.GetEnvironmentVariable(RequireDatabaseVariable),
                "true",
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"{RequireDatabaseVariable} is set but no PostgreSQL connection is configured. "
                + "Set FUSION_TEST_PG or ConnectionStrings__IdentityDb. These tests prove row locking, "
                + "index constraints, rollback, and concurrency, none of which run without a real database.");
        }
    }

    /// <summary>Creates and migrates a new database, returning a context on it.</summary>
    public async Task<AppIdentityDbContext> CreateAsync(string prefix = "fusion_test")
    {
        var name = $"{prefix}_{Guid.NewGuid():N}";

        await using (var connection = new NpgsqlConnection(AdminConnectionString))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = $"CREATE DATABASE \"{name}\";";
            await command.ExecuteNonQueryAsync();
        }

        _databases.Add(name);

        var context = new AppIdentityDbContext(OptionsFor(name));
        await context.Database.MigrateAsync();

        // Compatibility roles are derived output of authority, but they are still
        // written, so they have to exist for any flow that establishes an account.
        foreach (var role in PlatformRole.All)
        {
            await context.Database.ExecuteSqlRawAsync(
                """
                INSERT INTO identity."AspNetRoles" ("Id", "Name", "NormalizedName", "ConcurrencyStamp")
                SELECT {0}, {1}, {2}, {3}
                 WHERE NOT EXISTS (SELECT 1 FROM identity."AspNetRoles" WHERE "NormalizedName" = {2});
                """,
                Guid.NewGuid(), role, role.ToUpperInvariant(), Guid.NewGuid().ToString());
        }

        _contexts.Add(context);
        return context;
    }

    /// <summary>
    /// A second connection onto the same database, so two commands can genuinely
    /// race rather than sharing one change tracker.
    /// </summary>
    public AppIdentityDbContext Connect(AppIdentityDbContext existing)
    {
        var context = new AppIdentityDbContext(
            new DbContextOptionsBuilder<AppIdentityDbContext>()
                .UseNpgsql(existing.Database.GetConnectionString()!)
                .Options);

        _contexts.Add(context);
        return context;
    }

    public static UserManager<ApplicationUser> CreateUserManager(AppIdentityDbContext db)
    {
        var store = new UserStore<ApplicationUser, IdentityRole<Guid>, AppIdentityDbContext, Guid>(db);
        var options = new IdentityOptions { User = { RequireUniqueEmail = true } };

        return new UserManager<ApplicationUser>(
            store,
            Microsoft.Extensions.Options.Options.Create(options),
            new PasswordHasher<ApplicationUser>(),
            [new UserValidator<ApplicationUser>()],
            [],
            new UpperInvariantLookupNormalizer(),
            new IdentityErrorDescriber(),
            null!,
            NullLogger<UserManager<ApplicationUser>>.Instance);
    }

    private DbContextOptions<AppIdentityDbContext> OptionsFor(string database)
        => new DbContextOptionsBuilder<AppIdentityDbContext>()
            .UseNpgsql(new NpgsqlConnectionStringBuilder(AdminConnectionString) { Database = database }.ConnectionString)
            .Options;

    public async ValueTask DisposeAsync()
    {
        foreach (var context in _contexts)
        {
            await context.DisposeAsync();
        }

        if (!Available)
        {
            return;
        }

        foreach (var database in _databases)
        {
            try
            {
                await using var connection = new NpgsqlConnection(AdminConnectionString);
                await connection.OpenAsync();
                await using var command = connection.CreateCommand();
                command.CommandText = $"""
                    SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{database}';
                    """;
                await command.ExecuteNonQueryAsync();

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
}
