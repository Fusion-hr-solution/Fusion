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

        // Unique index on token for fast lookup
        builder.HasIndex(i => i.Token)
            .IsUnique();

        // Index for listing invites by tenant
        builder.HasIndex(i => i.TenantId);

        // Index for finding invites by email within a tenant
        builder.HasIndex(i => new { i.TenantId, i.Email });

        // Filtered unique index to prevent duplicate pending invites per {TenantId, Email}
        // Note: PostgreSQL filter syntax. Active invites = not accepted and not expired
        builder.HasIndex(i => new { i.TenantId, i.Email })
            .HasFilter("\"AcceptedAt\" IS NULL")
            .IsUnique()
            .HasDatabaseName("IX_InviteTokens_TenantId_Email_Pending");

        // Foreign key to Tenant
        builder.HasOne(i => i.Tenant)
            .WithMany()
            .HasForeignKey(i => i.TenantId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();
    }
}
