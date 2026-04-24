using EY.HRPlatform.Interview.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Interview.Infrastructure.Configurations;

public class CandidateProgressEventConfiguration : IEntityTypeConfiguration<CandidateProgressEvent>
{
    public void Configure(EntityTypeBuilder<CandidateProgressEvent> builder)
    {
        builder.ToTable("CandidateProgressEvents");
        builder.HasKey(x => x.Id);

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.UpdatedBy);

        builder.Property(x => x.CandidateEmail)
            .IsRequired()
            .HasMaxLength(320);

        builder.Property(x => x.CandidateName)
            .HasMaxLength(200);

        builder.Property(x => x.Milestone)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(x => x.OccurredAtUtc)
            .IsRequired();

        builder.Property(x => x.ClientIpAddress)
            .HasMaxLength(64);

        builder.Property(x => x.BrowserFingerprintHash)
            .HasMaxLength(128);

        builder.Property(x => x.UserAgent)
            .HasMaxLength(1024);

        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);

        builder.HasIndex(x => x.InvitationId);
        builder.HasIndex(x => x.TestId);
        builder.HasIndex(x => new { x.InvitationId, x.AttemptNumber, x.OccurredAtUtc });
        builder.HasIndex(x => new { x.Milestone, x.OccurredAtUtc });

        builder.HasOne(x => x.Invitation)
            .WithMany()
            .HasForeignKey(x => x.InvitationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Attempt)
            .WithMany()
            .HasForeignKey(x => x.AttemptId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(x => x.Test)
            .WithMany()
            .HasForeignKey(x => x.TestId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
