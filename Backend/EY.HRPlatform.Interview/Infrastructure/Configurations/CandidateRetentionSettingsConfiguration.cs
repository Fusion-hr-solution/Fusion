using EY.HRPlatform.Interview.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Interview.Infrastructure.Configurations;

public class CandidateRetentionSettingsConfiguration : IEntityTypeConfiguration<CandidateRetentionSettings>
{
    public void Configure(EntityTypeBuilder<CandidateRetentionSettings> builder)
    {
        builder.ToTable("CandidateRetentionSettings");
        builder.HasKey(x => x.Id);

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.UpdatedBy);

        builder.Property(x => x.Enabled)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(x => x.RetentionAction)
            .IsRequired()
            .HasMaxLength(32)
            .HasDefaultValue("Anonymize");

        builder.Property(x => x.RetentionPeriodDays)
            .IsRequired()
            .HasDefaultValue(90);

        builder.Property(x => x.ScanIntervalHours)
            .IsRequired()
            .HasDefaultValue(24);

        builder.Property(x => x.LastRunAtUtc)
            .IsRequired(false);

        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);
    }
}
