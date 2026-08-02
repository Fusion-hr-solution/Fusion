using EY.HRPlatform.Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Configurations;

public class InvitationDeliveryAttemptConfiguration : IEntityTypeConfiguration<InvitationDeliveryAttempt>
{
    public void Configure(EntityTypeBuilder<InvitationDeliveryAttempt> builder)
    {
        builder.ToTable("InvitationDeliveryAttempts");

        builder.HasKey(attempt => attempt.Id);

        builder.Property(attempt => attempt.Outcome)
            .HasConversion<string>()
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(attempt => attempt.AttemptedAt)
            .IsRequired();

        // Bounded code only. Raw provider errors are never persisted.
        builder.Property(attempt => attempt.SanitizedFailureCode)
            .HasMaxLength(64);

        // Reading the latest outcome for an invitation is the common query.
        builder.HasIndex(attempt => new { attempt.InvitationId, attempt.AttemptedAt })
            .HasDatabaseName("IX_InvitationDeliveryAttempts_InvitationId_AttemptedAt");

        builder.HasOne(attempt => attempt.Invitation)
            .WithMany()
            .HasForeignKey(attempt => attempt.InvitationId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();
    }
}
