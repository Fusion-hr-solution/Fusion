using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class PerformanceReviewConfiguration : IEntityTypeConfiguration<PerformanceReview>
{
    public void Configure(EntityTypeBuilder<PerformanceReview> builder)
    {
        builder.ToTable("PerformanceReviews");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Version).IsRowVersion();
        builder.Property(item => item.Kind).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(item => item.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(item => item.Narrative).HasMaxLength(4000);
        builder.Property(item => item.EvidenceReference).HasMaxLength(2000);
        builder.Property(item => item.CorrectionReason).HasMaxLength(1000);
        builder.HasIndex(item => item.WorkItemId).IsUnique();
        builder.HasIndex(item => new { item.TenantId, item.CycleId, item.SubjectEmployeeId, item.Kind });
        builder.HasMany(item => item.Criteria).WithOne().HasForeignKey(item => item.ReviewId).OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(PerformanceReview.Criteria))!.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Ignore(item => item.IsLocked);
        builder.Ignore(item => item.DomainEvents);
    }
}
