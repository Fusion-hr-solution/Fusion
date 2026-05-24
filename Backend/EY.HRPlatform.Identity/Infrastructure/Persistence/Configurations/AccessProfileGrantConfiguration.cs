using EY.HRPlatform.Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Configurations;

public class AccessProfileGrantConfiguration : IEntityTypeConfiguration<AccessProfileGrant>
{
    public void Configure(EntityTypeBuilder<AccessProfileGrant> builder)
    {
        builder.ToTable("AccessProfileGrants");

        builder.HasKey(grant => new { grant.AccessProfileId, grant.PermissionKey });

        builder.Property(grant => grant.PermissionKey)
            .HasMaxLength(120)
            .IsRequired();

        builder.Property(grant => grant.Scope)
            .HasMaxLength(32)
            .IsRequired();

        builder.HasIndex(grant => grant.TenantId);
        builder.HasIndex(grant => new { grant.TenantId, grant.PermissionKey });
    }
}
