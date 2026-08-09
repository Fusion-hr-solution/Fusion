using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public sealed class OrganizationalUnitTypeConfiguration : IEntityTypeConfiguration<OrganizationalUnitType>
{
    public void Configure(EntityTypeBuilder<OrganizationalUnitType> builder)
    {
        builder.ToTable("OrganizationalUnitTypes");
        builder.HasKey(type => type.Id);
        builder.Property(type => type.DisplayName).HasMaxLength(100).IsRequired();
        builder.Property(type => type.NormalizedName).HasMaxLength(100).IsRequired();
        builder.Property(type => type.IsBuiltIn).IsRequired();
        builder.Property(type => type.CreatedBy).HasMaxLength(256);
        builder.Property(type => type.UpdatedBy).HasMaxLength(256);
        builder.HasIndex(type => new { type.TenantId, type.NormalizedName })
            .IsUnique()
            .HasDatabaseName("UX_OrganizationalUnitTypes_TenantId_NormalizedName");
        builder.HasIndex(type => new { type.IsBuiltIn, type.NormalizedName })
            .IsUnique()
            .HasFilter("\"IsBuiltIn\" = true")
            .HasDatabaseName("UX_OrganizationalUnitTypes_BuiltIn_NormalizedName");
    }
}
