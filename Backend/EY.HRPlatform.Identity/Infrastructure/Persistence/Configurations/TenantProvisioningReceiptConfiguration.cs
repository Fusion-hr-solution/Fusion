using EY.HRPlatform.Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Configurations;

public class TenantProvisioningReceiptConfiguration : IEntityTypeConfiguration<TenantProvisioningReceipt>
{
    public void Configure(EntityTypeBuilder<TenantProvisioningReceipt> builder)
    {
        builder.ToTable("TenantProvisioningReceipts");

        // The idempotency key is the receipt's identity. Making it the primary key
        // is what makes concurrent identical requests converge on one committed
        // result, with no second way to name that result.
        builder.HasKey(receipt => receipt.IdempotencyKey);

        builder.Property(receipt => receipt.IdempotencyKey)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(receipt => receipt.RequestFingerprint)
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(receipt => receipt.CompletedAt)
            .IsRequired();

        builder.HasIndex(receipt => receipt.TenantId);

        // A receipt is the authoritative idempotency result, so it must not be
        // able to name a tenant that does not exist.
        builder.HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(receipt => receipt.TenantId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();

        // Tenant-safe composite binding: the bootstrap invitation must belong to
        // the same tenant the receipt provisioned.
        builder.HasOne<InviteToken>()
            .WithMany()
            .HasForeignKey(receipt => new
            {
                receipt.BootstrapInvitationId,
                receipt.TenantId,
            })
            .HasPrincipalKey(invitation => new
            {
                invitation.Id,
                invitation.TenantId,
            })
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();
    }
}
