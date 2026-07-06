using EY.HRPlatform.Performance.Domain.Entities.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations.Platform;

public class PlatformObjectiveBaselineVersionConfiguration : IEntityTypeConfiguration<PlatformObjectiveBaselineVersion>
{
    public void Configure(EntityTypeBuilder<PlatformObjectiveBaselineVersion> builder)
    {
        builder.ToTable("PlatformObjectiveBaselineVersions");
        builder.HasKey(v => v.Id);

        builder.Property(v => v.BaselineId).IsRequired();
        builder.Property(v => v.VersionNumber).IsRequired();
        builder.Property(v => v.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();
        builder.Property(v => v.MaxObjectivesPerPlan).IsRequired();
        builder.Property(v => v.AllowedWeightValues).HasMaxLength(500).IsRequired();
        builder.Property(v => v.MeasurementTypes).HasMaxLength(50).IsRequired();
        builder.Property(v => v.AppliedAt)
            .HasColumnName("PublishedAt");
        builder.Property(v => v.ReplacedAt)
            .HasColumnName("SupersededAt");
        builder.Property(v => v.CreatedBy).HasMaxLength(256);
        builder.Property(v => v.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(v => v.BaselineId)
            .HasDatabaseName("IX_PlatformObjectiveBaselineVersions_BaselineId");

        builder.HasIndex(v => new { v.BaselineId, v.Status })
            .HasDatabaseName("IX_PlatformObjectiveBaselineVersions_Baseline_Status");

        // No global query filter — platform-scoped entity (D1)
    }
}
