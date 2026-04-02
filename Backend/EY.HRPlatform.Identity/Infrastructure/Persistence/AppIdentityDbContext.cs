using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Infrastructure.Persistence.Configurations;
using EY.HRPlatform.SharedKernel.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence;

public class AppIdentityDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<InviteToken> InviteTokens => Set<InviteToken>();

    public AppIdentityDbContext(DbContextOptions<AppIdentityDbContext> options)
        : base(options)
    {
    }

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
    }
}