using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Configurations;

public class TenantMembershipConfiguration : IEntityTypeConfiguration<TenantMembership>
{
    public void Configure(EntityTypeBuilder<TenantMembership> builder)
    {
        builder.ToTable("TenantMemberships");

        builder.HasKey(membership => membership.Id);

        builder.Property(membership => membership.Status)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(membership => membership.CreatedAt)
            .IsRequired();

        // At most one membership per account/tenant pair.
        builder.HasIndex(membership => new { membership.UserId, membership.TenantId })
            .IsUnique()
            .HasDatabaseName("IX_TenantMemberships_UserId_TenantId");

        // MVP cardinality: an ordinary account has at most one Active customer
        // membership. Enforced in the database so no command path can bypass it.
        builder.HasIndex(membership => membership.UserId)
            .IsUnique()
            .HasFilter($"\"Status\" = '{nameof(TenantMembershipStatus.Active)}'")
            .HasDatabaseName("IX_TenantMemberships_UserId_ActiveUnique");

        builder.HasIndex(membership => membership.TenantId);

        // Alternate key that lets access assignments carry a tenant-safe composite
        // foreign key, making a cross-tenant assignment unstorable.
        builder.HasAlternateKey(membership => new
        {
            membership.Id,
            membership.UserId,
            membership.TenantId,
        }).HasName("AK_TenantMemberships_Id_UserId_TenantId");

        // Declared once, with both navigations, so EF does not infer a second
        // shadow relationship alongside it.
        builder.HasOne(membership => membership.User)
            .WithMany(user => user!.TenantMemberships)
            .HasForeignKey(membership => membership.UserId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();

        builder.HasOne(membership => membership.Tenant)
            .WithMany()
            .HasForeignKey(membership => membership.TenantId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();
    }
}
