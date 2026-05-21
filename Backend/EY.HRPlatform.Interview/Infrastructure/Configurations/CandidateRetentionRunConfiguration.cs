using EY.HRPlatform.Interview.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Interview.Infrastructure.Configurations;

public class CandidateRetentionRunConfiguration : IEntityTypeConfiguration<CandidateRetentionRun>
{
    public void Configure(EntityTypeBuilder<CandidateRetentionRun> builder)
    {
        builder.ToTable("CandidateRetentionRuns");
        builder.HasKey(x => x.Id);

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.UpdatedBy);

        builder.Property(x => x.TriggeredBy)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(x => x.TriggerSource)
            .IsRequired()
            .HasMaxLength(32);

        builder.Property(x => x.RetentionAction)
            .IsRequired()
            .HasMaxLength(32);

        builder.Property(x => x.RetentionPeriodDays).IsRequired();

        builder.Property(x => x.CandidatesScanned)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(x => x.CandidatesProcessed)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(x => x.CandidatesAnonymized)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(x => x.CandidatesDeleted)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(x => x.CandidatesExpired)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(x => x.StartedAtUtc).IsRequired();
        builder.Property(x => x.CompletedAtUtc).IsRequired(false);

        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);

        builder.HasIndex(x => x.StartedAtUtc);
        builder.HasIndex(x => x.TriggerSource);
    }
}
