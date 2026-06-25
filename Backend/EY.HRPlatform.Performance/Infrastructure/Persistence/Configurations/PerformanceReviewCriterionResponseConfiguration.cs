using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class PerformanceReviewCriterionResponseConfiguration : IEntityTypeConfiguration<PerformanceReviewCriterionResponse>
{
    public void Configure(EntityTypeBuilder<PerformanceReviewCriterionResponse> builder)
    {
        builder.ToTable("PerformanceReviewCriterionResponses");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Comment).HasMaxLength(2000);
        builder.HasIndex(item => new { item.ReviewId, item.CriterionSnapshotId }).IsUnique();
        builder.HasIndex(item => item.TenantId);
    }
}
