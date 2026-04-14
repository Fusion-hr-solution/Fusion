using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public class TenantSetupStateConfiguration : IEntityTypeConfiguration<TenantSetupState>
{
    public void Configure(EntityTypeBuilder<TenantSetupState> builder)
    {
        builder.ToTable("TenantSetupStates");
        builder.HasKey(s => s.Id);

        // Map Version property to PostgreSQL xmin system column for optimistic concurrency.
        builder.Property(s => s.Version).IsRowVersion();

        builder.Property(s => s.TenantId).IsRequired();

        builder.Property(s => s.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired()
            .HasDefaultValue(SetupStatus.NotStarted);

        builder.Property(s => s.OrgUnitsConfigured).IsRequired().HasDefaultValue(false);
        builder.Property(s => s.EmployeesImported).IsRequired().HasDefaultValue(false);

        // Audit fields inherited from BaseEntity
        builder.Property(s => s.CreatedBy).HasMaxLength(256);
        builder.Property(s => s.UpdatedBy).HasMaxLength(256);

        // One setup state row per tenant
        builder.HasIndex(s => s.TenantId)
            .IsUnique()
            .HasDatabaseName("IX_TenantSetupStates_TenantId");
    }
}
