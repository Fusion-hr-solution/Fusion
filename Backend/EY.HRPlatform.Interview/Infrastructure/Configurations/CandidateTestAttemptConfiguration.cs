using EY.HRPlatform.Interview.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Interview.Infrastructure.Configurations;

public class CandidateTestAttemptConfiguration : IEntityTypeConfiguration<CandidateTestAttempt>
{
    public void Configure(EntityTypeBuilder<CandidateTestAttempt> builder)
    {
        builder.ToTable("CandidateTestAttempts");
        builder.HasKey(x => x.Id);

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.UpdatedBy);

        builder.Property(x => x.AttemptNumber)
            .IsRequired()
            .HasDefaultValue(1);

        builder.Property(x => x.CandidateEmail)
            .IsRequired()
            .HasMaxLength(320);

        builder.Property(x => x.CandidateName)
            .HasMaxLength(200);

        builder.Property(x => x.StartedAtUtc)
            .IsRequired();

        builder.Property(x => x.SubmittedAtUtc);

        builder.Property(x => x.AnswersJson)
            .IsRequired();

        builder.Property(x => x.ResultJson)
            .IsRequired();

        builder.Property(x => x.GradingStatus)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired()
            .HasDefaultValue(Domain.Enums.GradingStatus.Pending);

        builder.Property(x => x.TotalScore).HasPrecision(5, 2);
        builder.Property(x => x.MaxScore).HasPrecision(5, 2);

        builder.Property(x => x.LastProctorHeartbeatUtc);

        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);

        builder.HasIndex(x => x.InvitationId);
        builder.HasIndex(x => new { x.InvitationId, x.AttemptNumber }).IsUnique();
        builder.HasIndex(x => x.TestId);
        builder.HasIndex(x => x.CandidateEmail);
        builder.HasIndex(x => x.SubmittedAtUtc);

        builder.HasOne(x => x.Test)
            .WithMany()
            .HasForeignKey(x => x.TestId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}