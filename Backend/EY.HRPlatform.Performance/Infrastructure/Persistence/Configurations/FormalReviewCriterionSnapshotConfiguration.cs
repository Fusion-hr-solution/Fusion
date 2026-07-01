using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class FormalReviewCriterionSnapshotConfiguration : IEntityTypeConfiguration<FormalReviewCriterionSnapshot>
{
    public void Configure(EntityTypeBuilder<FormalReviewCriterionSnapshot> builder)
    {
        builder.ToTable("FormalReviewCriterionSnapshots");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Name).HasMaxLength(200).IsRequired();
        builder.Property(item => item.Description).HasMaxLength(1000);
        builder.HasIndex(item => new { item.DefinitionSnapshotId, item.DisplayOrder }).IsUnique();
        builder.HasIndex(item => item.TenantId);
    }
}
