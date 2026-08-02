using EY.HRPlatform.Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Configurations;

public class InvitationActivationContinuationConfiguration
    : IEntityTypeConfiguration<InvitationActivationContinuation>
{
    public void Configure(EntityTypeBuilder<InvitationActivationContinuation> builder)
    {
        builder.ToTable("InvitationActivationContinuations");

        builder.HasKey(continuation => continuation.Id);

        builder.Property(continuation => continuation.HandleDigest)
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(continuation => continuation.CreatedAt)
            .IsRequired();

        builder.Property(continuation => continuation.ExpiresAt)
            .IsRequired();

        // Single-use handles: the unique digest stops a replayed handle from
        // resuming activation twice even under concurrency.
        builder.HasIndex(continuation => continuation.HandleDigest)
            .IsUnique()
            .HasDatabaseName("IX_InvitationActivationContinuations_HandleDigest");

        builder.HasIndex(continuation => continuation.InvitationId);

        builder.HasOne(continuation => continuation.Invitation)
            .WithMany()
            .HasForeignKey(continuation => continuation.InvitationId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();
    }
}
