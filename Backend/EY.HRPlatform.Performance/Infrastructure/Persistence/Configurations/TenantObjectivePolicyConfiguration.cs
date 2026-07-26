using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class TenantObjectivePolicyConfiguration : IEntityTypeConfiguration<TenantObjectivePolicy>
{
    public void Configure(EntityTypeBuilder<TenantObjectivePolicy> builder)
    {
        builder.ToTable("TenantObjectivePolicies");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.TenantId).IsRequired();
        builder.Property(p => p.CreatedBy).HasMaxLength(256);
        builder.Property(p => p.UpdatedBy).HasMaxLength(256);

        builder.HasMany(p => p.Versions)
            .WithOne()
            .HasForeignKey(v => v.PolicyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => p.TenantId)
            .IsUnique()
            .HasDatabaseName("IX_TenantObjectivePolicies_TenantId");
    }
}
