using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public class TenantSettingsConfiguration : IEntityTypeConfiguration<TenantSettings>
{
    public void Configure(EntityTypeBuilder<TenantSettings> builder)
    {
        builder.ToTable("TenantSettings");
        builder.HasKey(ts => ts.Id);

        // Map Version property to PostgreSQL xmin system column for optimistic concurrency.
        builder.Property(ts => ts.Version).IsRowVersion();

        builder.Property(ts => ts.TenantId).IsRequired();

        // JSONB column for tenant-specific overrides.
        // Null means tenant uses all defaults.
        builder.Property(ts => ts.SettingsOverrides)
            .HasColumnType("jsonb");

        // Audit fields inherited from BaseEntity
        builder.Property(ts => ts.CreatedBy).HasMaxLength(256);
        builder.Property(ts => ts.UpdatedBy).HasMaxLength(256);

        // One settings row per tenant
        builder.HasIndex(ts => ts.TenantId)
            .IsUnique()
            .HasDatabaseName("IX_TenantSettings_TenantId");
    }
}
