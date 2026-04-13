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

        builder.Property(x => x.TimeLimitMinutes);

        builder.Property(x => x.CustomMessage)
            .HasMaxLength(2000);

        builder.Property(x => x.InviteLink)
            .IsRequired()
            .HasMaxLength(1024);

        builder.Property(x => x.LastSentAtUtc)
            .IsRequired();

        builder.Property(x => x.ResendCount)
            .HasDefaultValue(0)
            .IsRequired();

        builder.Property(x => x.OpensCount)
            .HasDefaultValue(0)
            .IsRequired();

        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);

        builder.HasIndex(x => x.TestId);
        builder.HasIndex(x => x.Email);
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.CreatedAt);

        builder.HasOne(x => x.Test)
            .WithMany()
            .HasForeignKey(x => x.TestId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
