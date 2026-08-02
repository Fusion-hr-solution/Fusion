using EY.HRPlatform.Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Configurations;

public class TenantModuleEntitlementConfiguration : IEntityTypeConfiguration<TenantModuleEntitlement>
{
    public void Configure(EntityTypeBuilder<TenantModuleEntitlement> builder)
    {
        builder.ToTable("TenantModuleEntitlements");

        builder.HasKey(entitlement => entitlement.Id);

        builder.Property(entitlement => entitlement.Module)
            .HasConversion<string>()
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(entitlement => entitlement.CreatedAt)
            .IsRequired();

        // One record per tenant/module is the source of truth.
        builder.HasIndex(entitlement => new { entitlement.TenantId, entitlement.Module })
            .IsUnique()
            .HasDatabaseName("IX_TenantModuleEntitlements_TenantId_Module");

        builder.HasOne(entitlement => entitlement.Tenant)
            .WithMany()
            .HasForeignKey(entitlement => entitlement.TenantId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();
    }
}
