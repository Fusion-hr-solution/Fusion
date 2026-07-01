using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class PerformanceObjectiveMilestoneConfiguration : IEntityTypeConfiguration<PerformanceObjectiveMilestone>
{
    public void Configure(EntityTypeBuilder<PerformanceObjectiveMilestone> builder)
    {
        builder.ToTable("PerformanceObjectiveMilestones");
        builder.HasKey(milestone => milestone.Id);
        builder.Property(milestone => milestone.Title).HasMaxLength(300).IsRequired();
        builder.HasIndex(milestone => new { milestone.TenantId, milestone.ObjectiveId, milestone.DueDate });
    }
}
