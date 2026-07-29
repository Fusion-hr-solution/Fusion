using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Infrastructure.Persistence.Configurations;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

using EY.HRPlatform.DemoSeed;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence;

public class AppIdentityDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    private readonly ITenantContext? _tenantContext;

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<InviteToken> InviteTokens => Set<InviteToken>();
    public DbSet<AccessProfile> AccessProfiles => Set<AccessProfile>();
    public DbSet<AccessProfileGrant> AccessProfileGrants => Set<AccessProfileGrant>();
    public DbSet<UserAccessProfile> UserAccessProfiles => Set<UserAccessProfile>();
    public DbSet<UserAccessProfileOrgUnitScope> UserAccessProfileOrgUnitScopes => Set<UserAccessProfileOrgUnitScope>();
    public DbSet<InviteAccessProfile> InviteAccessProfiles => Set<InviteAccessProfile>();
    public DbSet<AccessAuditEvent> AccessAuditEvents => Set<AccessAuditEvent>();
    public DbSet<CanonicalSeedReceipt> CanonicalSeedReceipts => Set<CanonicalSeedReceipt>();

    /// <summary>
    /// Runtime constructor with tenant context for production use.
    /// </summary>
    public AppIdentityDbContext(DbContextOptions<AppIdentityDbContext> options, ITenantContext tenantContext)
        : base(options)
    {
        _tenantContext = tenantContext;
    }

    /// <summary>
    /// Design-time constructor for EF migrations tooling and test seeding.
    /// </summary>
    public AppIdentityDbContext(DbContextOptions<AppIdentityDbContext> options)
        : base(options)
    {
        _tenantContext = null;
    }

    /// <summary>
    /// Current tenant ID used for query filters. Returns Empty when no tenant resolved
    /// (design-time, startup seeding, or unauthenticated), which disables filtering (fail-open).
    /// </summary>
    private Guid CurrentTenantId => _tenantContext?.TenantIdOrDefault ?? Guid.Empty;

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Ensure all DateTime properties are normalized to UTC before being sent to PostgreSQL
        configurationBuilder.Properties<DateTime>()
            .HaveConversion<UtcDateTimeConverter>();

        configurationBuilder.Properties<DateTime?>()
            .HaveConversion<UtcNullableDateTimeConverter>();
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<CanonicalSeedReceipt>(entity =>
        {
            entity.ToTable("CanonicalSeedReceipts");
            entity.HasKey(receipt => receipt.Id);
            entity.HasIndex(receipt => new { receipt.TenantId, receipt.ManifestVersion }).IsUnique();
            entity.Property(receipt => receipt.ManifestVersion).HasMaxLength(200).IsRequired();
            entity.Property(receipt => receipt.ManifestHash).HasMaxLength(128).IsRequired();
        });

        // All identity tables go into the "identity" schema
        builder.HasDefaultSchema("identity");

        // ApplicationUser table configuration
        builder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(u => u.FirstName)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(u => u.LastName)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(u => u.Department)
                .HasMaxLength(100);

            entity.Property(u => u.JobTitle)
                .HasMaxLength(100);

            // User belongs to exactly one tenant
            entity.HasOne(u => u.Tenant)
                .WithMany()
                .HasForeignKey(u => u.TenantId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired();

            entity.HasIndex(u => u.TenantId);

            entity.HasIndex(u => new { u.TenantId, u.EmployeeId })
                .IsUnique()
                .HasFilter("\"EmployeeId\" IS NOT NULL");
        });

        // RefreshToken table configuration
        builder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(rt => rt.Id);

            entity.Property(rt => rt.Token)
                .HasMaxLength(500)
                .IsRequired();

            entity.HasIndex(rt => rt.Token)
                .IsUnique();

            entity.HasIndex(rt => rt.UserId);
        });

        // Tenant table configuration
        builder.ApplyConfiguration(new TenantConfiguration());

        // InviteToken table configuration
        builder.ApplyConfiguration(new InviteTokenConfiguration());
        builder.ApplyConfiguration(new AccessProfileConfiguration());
        builder.ApplyConfiguration(new AccessProfileGrantConfiguration());
        builder.ApplyConfiguration(new UserAccessProfileConfiguration());
        builder.ApplyConfiguration(new UserAccessProfileOrgUnitScopeConfiguration());
        builder.ApplyConfiguration(new InviteAccessProfileConfiguration());

        // Global tenant query filters: automatically scope queries to the current tenant.
        // When CurrentTenantId is Empty (design-time/startup/no context), filters are disabled (fail-open).
        // Use IgnoreQueryFilters() for cross-tenant operations (auth, platform admin, anonymous invites).
        builder.Entity<ApplicationUser>()
            .HasQueryFilter(u => CurrentTenantId == Guid.Empty || u.TenantId == CurrentTenantId);

        builder.Entity<InviteToken>()
            .HasQueryFilter(i => CurrentTenantId == Guid.Empty || i.TenantId == CurrentTenantId);

        builder.Entity<AccessProfile>()
            .HasQueryFilter(profile => CurrentTenantId == Guid.Empty || profile.TenantId == CurrentTenantId);

        builder.Entity<AccessProfileGrant>()
            .HasQueryFilter(grant => CurrentTenantId == Guid.Empty || grant.TenantId == CurrentTenantId);

        builder.Entity<UserAccessProfile>()
            .HasQueryFilter(assignment => CurrentTenantId == Guid.Empty || assignment.TenantId == CurrentTenantId);

        builder.Entity<UserAccessProfileOrgUnitScope>()
            .HasQueryFilter(scope => CurrentTenantId == Guid.Empty || scope.TenantId == CurrentTenantId);

        builder.Entity<InviteAccessProfile>()
            .HasQueryFilter(assignment => CurrentTenantId == Guid.Empty || assignment.TenantId == CurrentTenantId);

        builder.Entity<AccessAuditEvent>()
            .HasQueryFilter(auditEvent => CurrentTenantId == Guid.Empty || auditEvent.TenantId == CurrentTenantId);
    }
}
