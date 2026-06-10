using EY.HRPlatform.Interview.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Interview.Infrastructure.Configurations;

public class GradingJobConfiguration : IEntityTypeConfiguration<GradingJob>
{
    public void Configure(EntityTypeBuilder<GradingJob> builder)
    {
        builder.ToTable("GradingJobs");
        builder.HasKey(x => x.Id);

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.UpdatedBy);
        builder.Ignore(x => x.UpdatedAt);

        builder.Property(x => x.RetryCount).HasDefaultValue(0).IsRequired();
        builder.Property(x => x.LockedBy).HasMaxLength(200);
        builder.Property(x => x.ErrorMessage).HasMaxLength(2000);

        builder.HasIndex(x => new { x.LockedAt, x.CompletedAt });

        builder.HasOne(x => x.Attempt)
            .WithMany()
            .HasForeignKey(x => x.AttemptId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
