using EY.HRPlatform.Interview.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Interview.Infrastructure.Configurations;

public class CandidateInvitationConfiguration : IEntityTypeConfiguration<CandidateInvitation>
{
    public void Configure(EntityTypeBuilder<CandidateInvitation> builder)
    {
        builder.ToTable("CandidateInvitations");
        builder.HasKey(x => x.Id);

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.UpdatedBy);

        builder.Property(x => x.TestTitle)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(x => x.Email)
            .IsRequired()
            .HasMaxLength(320);

        builder.Property(x => x.CandidateName)
            .HasMaxLength(200);

        builder.Property(x => x.Status)
            .IsRequired()
            .HasMaxLength(32);

        builder.Property(x => x.DeadlineUtc);

        builder.Property(x => x.InviteMethod)
            .IsRequired()
            .HasMaxLength(16)
            .HasDefaultValue("email");

        builder.Property(x => x.LinkExpiryHours)
            .IsRequired()
            .HasDefaultValue(72);

        builder.Property(x => x.TimeLimitMinutes);

        builder.Property(x => x.CustomMessage)
            .HasMaxLength(2000);

        builder.Property(x => x.InviteLink)
            .IsRequired()
            .HasMaxLength(1024);

        builder.Property(x => x.TokenHash)
            .IsRequired()
            .HasMaxLength(128);

        builder.Property(x => x.TokenCreatedAtUtc)
            .IsRequired();

        builder.Property(x => x.TokenExpiresAtUtc)
            .IsRequired();

        builder.Property(x => x.LastSentAtUtc)
            .IsRequired();

        builder.Property(x => x.ResendCount)
            .HasDefaultValue(0)
            .IsRequired();

        builder.Property(x => x.OpensCount)
            .HasDefaultValue(0)
            .IsRequired();

        builder.Property(x => x.AttemptStartedAtUtc);
        builder.Property(x => x.AttemptSubmittedAtUtc);

        builder.Property(x => x.VerifiedEmail)
            .HasMaxLength(320);

        builder.Property(x => x.EmailVerifiedAtUtc);

        builder.Property(x => x.LockedIpAddress)
            .HasMaxLength(64);

        builder.Property(x => x.AccessFingerprintHash)
            .HasMaxLength(128);

        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);

        builder.HasIndex(x => x.TestId);
        builder.HasIndex(x => x.Email);
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.CreatedAt);
        builder.HasIndex(x => x.TokenHash).IsUnique();
        builder.HasIndex(x => x.TokenExpiresAtUtc);

        builder.HasOne(x => x.Test)
            .WithMany()
            .HasForeignKey(x => x.TestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Attempts)
            .WithOne(x => x.Invitation)
            .HasForeignKey(x => x.InvitationId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
