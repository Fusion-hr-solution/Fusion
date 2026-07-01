using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class FormalReviewDefinitionSnapshotConfiguration : IEntityTypeConfiguration<FormalReviewDefinitionSnapshot>
{
    public void Configure(EntityTypeBuilder<FormalReviewDefinitionSnapshot> builder)
    {
        builder.ToTable("FormalReviewDefinitionSnapshots");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Kind).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(item => item.Name).HasMaxLength(200).IsRequired();
        builder.Property(item => item.RatingScaleName).HasMaxLength(120).IsRequired();
        builder.HasIndex(item => new { item.TenantId, item.CycleId, item.Kind }).IsUnique();
        builder.HasMany(item => item.Criteria).WithOne().HasForeignKey(item => item.DefinitionSnapshotId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(item => item.RatingScaleLevels).WithOne().HasForeignKey(item => item.DefinitionSnapshotId).OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(FormalReviewDefinitionSnapshot.Criteria))!.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(FormalReviewDefinitionSnapshot.RatingScaleLevels))!.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Ignore(item => item.DomainEvents);
    }
}
