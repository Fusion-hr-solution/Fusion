using EY.HRPlatform.Identity.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence;

public class AppIdentityDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

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
    }
}

internal class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
    v => v.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v, DateTimeKind.Utc),
    v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

internal class UtcNullableDateTimeConverter() : ValueConverter<DateTime?, DateTime?>(
    v => v.HasValue && v.Value.Kind != DateTimeKind.Utc ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v,
    v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);