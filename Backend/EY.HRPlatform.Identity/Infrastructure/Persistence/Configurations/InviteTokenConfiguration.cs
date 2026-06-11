using EY.HRPlatform.Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Configurations;

public class InviteTokenConfiguration : IEntityTypeConfiguration<InviteToken>
{
    public void Configure(EntityTypeBuilder<InviteToken> builder)
    {
        builder.ToTable("InviteTokens");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Token)
            .HasMaxLength(64) // 32 bytes base64url ≈ 43 chars, allow headroom
            .IsRequired();

        builder.Property(i => i.Email)
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(i => i.Role)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(i => i.FirstName)
            .HasMaxLength(100);

        builder.Property(i => i.LastName)
            .HasMaxLength(100);

        builder.Property(i => i.DeliveryStatus)
            .HasMaxLength(50);

        builder.Property(i => i.DeliveryMessage)
            .HasMaxLength(500);

        builder.Property(i => i.IsRevoked)
            .IsRequired()
            .HasDefaultValue(false);

        // Unique index on token for fast lookup
        builder.HasIndex(i => i.Token)
            .IsUnique();

        // Index for listing invites by tenant
        builder.HasIndex(i => i.TenantId);

        builder.HasIndex(i => new { i.TenantId, i.EmployeeId });

        // Filtered unique index to prevent duplicate pending invites per {TenantId, Email}
        // Active invites = not accepted, not revoked
        builder.HasIndex(i => new { i.TenantId, i.Email })
            .HasFilter("\"AcceptedAt\" IS NULL AND \"IsRevoked\" = false")
            .IsUnique()
            .HasDatabaseName("IX_InviteTokens_TenantId_Email_Pending");

        builder.HasIndex(i => new { i.TenantId, i.EmployeeId })
            .HasFilter("\"EmployeeId\" IS NOT NULL AND \"AcceptedAt\" IS NULL AND \"IsRevoked\" = false")
            .IsUnique()
            .HasDatabaseName("IX_InviteTokens_TenantId_EmployeeId_Pending");

        // Foreign key to Tenant
        builder.HasOne(i => i.Tenant)
            .WithMany()
            .HasForeignKey(i => i.TenantId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();
    }
}
