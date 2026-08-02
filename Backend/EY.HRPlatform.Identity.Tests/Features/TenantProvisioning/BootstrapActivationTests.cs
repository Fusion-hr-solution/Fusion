using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Features.TenantProvisioning;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EY.HRPlatform.Identity.Tests.Features.TenantProvisioning;

/// <summary>
/// Bootstrap activation against real PostgreSQL. The rules under test are
/// transactional and constraint-backed — one membership, one access assignment,
/// no partial state — so they need a real database.
/// </summary>
public sealed class BootstrapActivationTests : IAsyncLifetime
{
    private static readonly Guid Actor = new("dddddddd-0000-0000-0000-00000000000d");
    private const string InvitedEmail = "admin@atlas.example";

    private string? _admin;
    private readonly List<string> _databases = [];
    private bool Available => _admin is not null;

    public Task InitializeAsync()
    {
        var configured = Environment.GetEnvironmentVariable("FUSION_TEST_PG")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (!string.IsNullOrWhiteSpace(configured)) _admin = configured;
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        if (!Available) return;
        foreach (var database in _databases) await DropAsync(database);
    }

    // ── Successful activation ────────────────────────────

    [SkippableFact]
    public async Task New_account_activation_establishes_durable_tenant_access()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var (db, credential, tenantId, _) = await ProvisionAsync();
        await using var _db = db;

        var result = await CreateService(db).ActivateAsync(new BootstrapActivationRequest
        {
            Credential = credential,
            Email = InvitedEmail,
            Password = "Bootstrap@123456",
            FirstName = "Ada",
            LastName = "Admin",
        });

        Assert.Equal(BootstrapActivationOutcome.Activated, result.Outcome);

        // Exactly one Active membership, and the tenant is now Active.
        var membership = Assert.Single(await db.TenantMemberships.IgnoreQueryFilters()
            .Where(m => m.TenantId == tenantId).ToListAsync());
        Assert.True(membership.IsActive);

        var tenant = await db.Tenants.IgnoreQueryFilters().SingleAsync(t => t.Id == tenantId);
        Assert.Equal(TenantAdministratorActivationStatus.Active, tenant.AdministratorActivationStatus);

        // Access is membership-bound, not account-bound.
        var access = Assert.Single(await db.UserAccessProfiles.IgnoreQueryFilters()
            .Where(a => a.TenantId == tenantId).ToListAsync());
        Assert.Equal(membership.Id, access.TenantMembershipId);

        var invitation = await db.InviteTokens.IgnoreQueryFilters().SingleAsync(i => i.TenantId == tenantId);
        Assert.Equal(InvitationState.Accepted, invitation.State);

        Assert.Contains(await db.TenantBootstrapAuditEvents.IgnoreQueryFilters()
            .Where(a => a.TenantId == tenantId).ToListAsync(),
            a => a.EventType == TenantBootstrapAuditEventType.BootstrapCompleted);

        // The detailed permission change is recorded in the existing access audit,
        // not only as a bootstrap outcome.
        Assert.Single(await db.AccessAuditEvents.IgnoreQueryFilters()
            .Where(a => a.TenantId == tenantId && a.Action == "access.assignment.granted").ToListAsync());
    }

    [SkippableFact]
    public async Task An_eligible_existing_account_may_accept()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var (db, credential, tenantId, _) = await ProvisionAsync();
        await using var _db = db;

        var users = CreateUserManager(db);
        var existing = NewAccount(InvitedEmail);
        await users.CreateAsync(existing, "Existing@123456");

        var result = await CreateService(db).ActivateAsync(new BootstrapActivationRequest
        {
            Credential = credential,
            Email = InvitedEmail,
        });

        Assert.Equal(BootstrapActivationOutcome.Activated, result.Outcome);
        Assert.Equal(existing.Id, result.AccountId);

        // The existing account is used, not duplicated.
        Assert.Single(await db.Users.IgnoreQueryFilters()
            .Where(u => u.NormalizedEmail == InvitedEmail.ToUpperInvariant()).ToListAsync());
    }

    // ── Eligibility ──────────────────────────────────────

    [SkippableFact]
    public async Task An_account_that_already_belongs_to_a_tenant_is_ineligible()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var (db, credential, tenantId, _) = await ProvisionAsync();
        await using var _db = db;

        var users = CreateUserManager(db);
        var existing = NewAccount(InvitedEmail);
        await users.CreateAsync(existing, "Existing@123456");

        // Any membership of any status disqualifies: this MVP does not transfer
        // or reactivate an account between customer tenants.
        var other = Tenant.Create(Guid.NewGuid(), "Other Tenant");
        db.Tenants.Add(other);
        db.TenantMemberships.Add(TenantMembership.Create(existing.Id, other.Id));
        await db.SaveChangesAsync();

        var result = await CreateService(db).ActivateAsync(new BootstrapActivationRequest
        {
            Credential = credential,
            Email = InvitedEmail,
        });

        Assert.Equal(BootstrapActivationOutcome.AccountIneligible, result.Outcome);
        await AssertNothingCommittedAsync(db, tenantId);
    }

    [SkippableFact]
    public async Task A_platform_administrator_cannot_accept_a_customer_invitation()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var (db, credential, tenantId, _) = await ProvisionAsync();
        await using var _db = db;

        var users = CreateUserManager(db);
        var admin = NewAccount(InvitedEmail);
        await users.CreateAsync(admin, "Platform@123456");
        await SeedPlatformAdminRoleAsync(db, users, admin);

        var result = await CreateService(db).ActivateAsync(new BootstrapActivationRequest
        {
            Credential = credential,
            Email = InvitedEmail,
        });

        // Control-plane authority never converts into customer membership.
        Assert.Equal(BootstrapActivationOutcome.AccountIneligible, result.Outcome);
        await AssertNothingCommittedAsync(db, tenantId);
    }

    [SkippableFact]
    public async Task An_account_with_no_usable_credential_is_ineligible()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var (db, credential, tenantId, _) = await ProvisionAsync();
        await using var _db = db;

        // Active, no membership, not a Platform Administrator — but no password
        // and no external login, so it could never sign in. Accepting it would
        // strand the tenant with an administrator who cannot reach it.
        db.Users.Add(NewAccount(InvitedEmail));
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var result = await CreateService(db).ActivateAsync(new BootstrapActivationRequest
        {
            Credential = credential,
            Email = InvitedEmail,
        });

        Assert.Equal(BootstrapActivationOutcome.AccountIneligible, result.Outcome);
        await AssertNothingCommittedAsync(db, tenantId);
    }

    [SkippableFact]
    public async Task A_suspended_tenant_cannot_be_reopened_by_its_invitation()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var (db, credential, tenantId, _) = await ProvisionAsync();
        await using var _db = db;

        var tenant = await db.Tenants.IgnoreQueryFilters().SingleAsync(t => t.Id == tenantId);
        tenant.Deactivate();
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var result = await CreateService(db).ActivateAsync(new BootstrapActivationRequest
        {
            Credential = credential, Email = InvitedEmail, Password = "Bootstrap@123456",
        });

        // Authority that was administratively withdrawn stays withdrawn.
        Assert.Equal(BootstrapActivationOutcome.NotActivatable, result.Outcome);
        await AssertNothingCommittedAsync(db, tenantId);
    }

    // ── Terminal and neutral responses ───────────────────

    [SkippableFact]
    public async Task Replaying_an_accepted_invitation_is_neutral_and_duplicates_nothing()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var (db, credential, tenantId, _) = await ProvisionAsync();
        await using var _db = db;
        var service = CreateService(db);

        var request = new BootstrapActivationRequest
        {
            Credential = credential, Email = InvitedEmail, Password = "Bootstrap@123456",
        };
        Assert.Equal(BootstrapActivationOutcome.Activated, (await service.ActivateAsync(request)).Outcome);
        db.ChangeTracker.Clear();

        var replay = await service.ActivateAsync(request);

        // Terminal, and deliberately says nothing about who accepted it.
        Assert.Equal(BootstrapActivationOutcome.AlreadyAccepted, replay.Outcome);
        Assert.Null(replay.TenantId);
        Assert.Null(replay.AccountId);

        Assert.Single(await db.TenantMemberships.IgnoreQueryFilters()
            .Where(m => m.TenantId == tenantId).ToListAsync());
        Assert.Single(await db.UserAccessProfiles.IgnoreQueryFilters()
            .Where(a => a.TenantId == tenantId).ToListAsync());
        Assert.Single(await db.TenantBootstrapAuditEvents.IgnoreQueryFilters()
            .Where(a => a.TenantId == tenantId
                && a.EventType == TenantBootstrapAuditEventType.BootstrapCompleted).ToListAsync());
    }

    [SkippableTheory]
    [InlineData("")]
    [InlineData("garbage")]
    [InlineData("no-separator-here")]
    [InlineData("unknown-selector.unknown-secret")]
    public async Task An_unusable_credential_is_refused_without_disclosure(string credential)
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var (db, _, tenantId, _) = await ProvisionAsync();
        await using var _db = db;

        var result = await CreateService(db).ActivateAsync(new BootstrapActivationRequest
        {
            Credential = credential, Email = InvitedEmail, Password = "Bootstrap@123456",
        });

        // Malformed and simply-wrong credentials give the same answer.
        Assert.Equal(BootstrapActivationOutcome.NotActivatable, result.Outcome);
        Assert.Null(result.TenantId);
        await AssertNothingCommittedAsync(db, tenantId);
    }

    [SkippableFact]
    public async Task A_correct_credential_with_the_wrong_email_is_refused()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var (db, credential, tenantId, _) = await ProvisionAsync();
        await using var _db = db;

        var result = await CreateService(db).ActivateAsync(new BootstrapActivationRequest
        {
            Credential = credential,
            Email = "someone.else@atlas.example",
            Password = "Bootstrap@123456",
        });

        Assert.Equal(BootstrapActivationOutcome.NotActivatable, result.Outcome);
        await AssertNothingCommittedAsync(db, tenantId);
    }

    [SkippableFact]
    public async Task A_revoked_invitation_cannot_activate()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var (db, credential, tenantId, invitationId) = await ProvisionAsync();
        await using var _db = db;

        await new BootstrapInvitationRecoveryService(db, new NoOpDelivery())
            .RevokeAsync(tenantId, invitationId, Actor);
        db.ChangeTracker.Clear();

        var result = await CreateService(db).ActivateAsync(new BootstrapActivationRequest
        {
            Credential = credential, Email = InvitedEmail, Password = "Bootstrap@123456",
        });

        Assert.Equal(BootstrapActivationOutcome.NotActivatable, result.Outcome);
        await AssertNothingCommittedAsync(db, tenantId);

        // A bounded, sanitized rejection is recorded — no credential, no address.
        var rejection = Assert.Single(await db.TenantBootstrapAuditEvents.IgnoreQueryFilters()
            .Where(a => a.EventType == TenantBootstrapAuditEventType.ActivationRejected).ToListAsync());
        Assert.Equal("Rejected", rejection.Outcome);
        Assert.DoesNotContain(InvitedEmail, rejection.Reason ?? string.Empty, StringComparison.OrdinalIgnoreCase);
    }

    [SkippableFact]
    public async Task A_superseded_invitation_cannot_activate_after_replacement()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var (db, credential, tenantId, invitationId) = await ProvisionAsync();
        await using var _db = db;

        await new BootstrapInvitationRecoveryService(db, new NoOpDelivery())
            .ReplaceAsync(tenantId, invitationId, "replacement@atlas.example", Actor);
        db.ChangeTracker.Clear();

        // The original recipient's link stops working once replaced.
        var result = await CreateService(db).ActivateAsync(new BootstrapActivationRequest
        {
            Credential = credential, Email = InvitedEmail, Password = "Bootstrap@123456",
        });

        Assert.Equal(BootstrapActivationOutcome.NotActivatable, result.Outcome);
        await AssertNothingCommittedAsync(db, tenantId);
    }

    // ── plumbing ─────────────────────────────────────────

    private static async Task AssertNothingCommittedAsync(AppIdentityDbContext db, Guid tenantId)
    {
        Assert.Empty(await db.TenantMemberships.IgnoreQueryFilters()
            .Where(m => m.TenantId == tenantId).ToListAsync());
        Assert.Empty(await db.UserAccessProfiles.IgnoreQueryFilters()
            .Where(a => a.TenantId == tenantId).ToListAsync());

        var tenant = await db.Tenants.IgnoreQueryFilters().SingleAsync(t => t.Id == tenantId);
        Assert.Equal(TenantAdministratorActivationStatus.AwaitingAdministratorActivation,
            tenant.AdministratorActivationStatus);
    }

    private static ApplicationUser NewAccount(string email) => new()
    {
        Id = Guid.NewGuid(),
        UserName = email,
        Email = email,
        NormalizedEmail = email.ToUpperInvariant(),
        NormalizedUserName = email.ToUpperInvariant(),
        FirstName = "Existing",
        LastName = "Account",
        IsActive = true,
        EmailConfirmed = true,
        SecurityStamp = Guid.NewGuid().ToString(),
    };

    private static async Task SeedPlatformAdminRoleAsync(
        AppIdentityDbContext db, UserManager<ApplicationUser> users, ApplicationUser account)
    {
        await db.Database.ExecuteSqlRawAsync($"""
            INSERT INTO identity."AspNetUserRoles" ("UserId","RoleId")
            SELECT '{account.Id}', "Id" FROM identity."AspNetRoles"
            WHERE "NormalizedName" = '{PlatformRole.PlatformAdmin.ToUpperInvariant()}';
            """);
        db.ChangeTracker.Clear();
    }

    private IBootstrapActivationService CreateService(AppIdentityDbContext db)
    {
        var users = CreateUserManager(db);
        return new BootstrapActivationService(db, users, new AccessProfileService(db, users));
    }

    private static UserManager<ApplicationUser> CreateUserManager(AppIdentityDbContext db)
    {
        var store = new UserStore<ApplicationUser, IdentityRole<Guid>, AppIdentityDbContext, Guid>(db);
        return new UserManager<ApplicationUser>(
            store,
            Microsoft.Extensions.Options.Options.Create(new IdentityOptions()),
            new PasswordHasher<ApplicationUser>(),
            [],
            [],
            new UpperInvariantLookupNormalizer(),
            new IdentityErrorDescriber(),
            null!,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<UserManager<ApplicationUser>>.Instance);
    }

    /// <summary>Provisions a tenant and returns its raw activation credential.</summary>
    private async Task<(AppIdentityDbContext Db, string Credential, Guid TenantId, Guid InvitationId)> ProvisionAsync()
    {
        var db = await CreateDatabaseAsync();
        var capture = new CapturingDelivery();

        var result = await new TenantProvisioningService(db, capture).ProvisionAsync(new ProvisionTenantRequest
        {
            Name = "Atlas Group",
            TimeZone = "Europe/Paris",
            AdministratorEmail = InvitedEmail,
            IdempotencyKey = "activation-key",
        }, Actor);

        Assert.True(result.IsSuccess);
        db.ChangeTracker.Clear();
        return (db, capture.Credential!.RawValue, result.Value.TenantId, result.Value.BootstrapInvitationId);
    }

    private sealed class CapturingDelivery : IBootstrapInvitationDelivery
    {
        public BootstrapCredential? Credential { get; private set; }

        public Task DeliverAsync(Guid invitationId, string email, BootstrapCredential credential,
            Guid initiatedByAccountId, CancellationToken cancellationToken = default)
        {
            Credential = credential;
            return Task.CompletedTask;
        }
    }

    private sealed class NoOpDelivery : IBootstrapInvitationDelivery
    {
        public Task DeliverAsync(Guid invitationId, string email, BootstrapCredential credential,
            Guid initiatedByAccountId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private async Task<AppIdentityDbContext> CreateDatabaseAsync()
    {
        var name = $"fusion_activation_test_{Guid.NewGuid():N}";
        await using (var connection = new NpgsqlConnection(AdminConnectionString()))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = $"CREATE DATABASE \"{name}\";";
            await command.ExecuteNonQueryAsync();
        }

        _databases.Add(name);

        var options = new DbContextOptionsBuilder<AppIdentityDbContext>()
            .UseNpgsql(new NpgsqlConnectionStringBuilder(_admin) { Database = name }.ConnectionString)
            .Options;

        var context = new AppIdentityDbContext(options);
        await context.Database.MigrateAsync();

        // Production seeds the platform roles at startup; activation synchronizes
        // the compatibility role afterwards. Seed them so the scratch database
        // matches the environment the service actually runs in.
        foreach (var role in PlatformRole.All)
        {
            await context.Database.ExecuteSqlRawAsync($"""
                INSERT INTO identity."AspNetRoles" ("Id","Name","NormalizedName","ConcurrencyStamp")
                VALUES ('{Guid.NewGuid()}', '{role}', '{role.ToUpperInvariant()}', '{Guid.NewGuid()}');
                """);
        }

        return context;
    }

    private async Task DropAsync(string database)
    {
        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(AdminConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"DROP DATABASE IF EXISTS \"{database}\" WITH (FORCE);";
        await command.ExecuteNonQueryAsync();
    }

    private string AdminConnectionString()
        => new NpgsqlConnectionStringBuilder(_admin) { Database = "postgres" }.ConnectionString;
}
