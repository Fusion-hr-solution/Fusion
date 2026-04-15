using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public class TenantSetupStateConfiguration : IEntityTypeConfiguration<TenantSetupState>
{
    public void Configure(EntityTypeBuilder<TenantSetupState> builder)
    {
        builder.ToTable("TenantSetupStates");
        builder.HasKey(ts => ts.Id);

        builder.Property(ts => ts.Version).IsRowVersion();

        builder.Property(ts => ts.TenantId).IsRequired();

        builder.Property(ts => ts.CurrentPhase)
            .HasConversion<string>()
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(ts => ts.CreatedBy).HasMaxLength(256);
        builder.Property(ts => ts.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(ts => ts.TenantId)
            .IsUnique()
            .HasDatabaseName("IX_TenantSetupStates_TenantId");
    }
}