using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class ScheduledJobRunConfiguration : IEntityTypeConfiguration<ScheduledJobRun>
{
    public void Configure(EntityTypeBuilder<ScheduledJobRun> builder)
    {
        builder.ToTable("ScheduledJobRuns");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.JobName).HasMaxLength(120).IsRequired();
        builder.Property(r => r.TenantId);
        builder.Property(r => r.StartedAt).IsRequired();
        builder.Property(r => r.CompletedAt);
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(r => r.ItemsAffected).IsRequired();
        builder.Property(r => r.Error).HasMaxLength(2000);
        builder.Property(r => r.CreatedBy).HasMaxLength(256);
        builder.Property(r => r.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(r => new { r.JobName, r.StartedAt })
            .HasDatabaseName("IX_ScheduledJobRuns_JobName_StartedAt");
    }
}
