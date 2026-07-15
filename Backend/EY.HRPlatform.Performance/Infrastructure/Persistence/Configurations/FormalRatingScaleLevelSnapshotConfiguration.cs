using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class FormalRatingScaleLevelSnapshotConfiguration : IEntityTypeConfiguration<FormalRatingScaleLevelSnapshot>
{
    public void Configure(EntityTypeBuilder<FormalRatingScaleLevelSnapshot> builder)
    {
        builder.ToTable("FormalRatingScaleLevelSnapshots");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Label).HasMaxLength(120).IsRequired();
        builder.Property(item => item.Description).HasMaxLength(1000);
        builder.HasIndex(item => new { item.DefinitionSnapshotId, item.Value }).IsUnique();
        builder.HasIndex(item => item.TenantId);
    }
}
