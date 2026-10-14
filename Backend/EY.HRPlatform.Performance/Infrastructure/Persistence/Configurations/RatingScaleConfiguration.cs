using EY.HRPlatform.Performance.Domain.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class RatingScaleConfiguration : IEntityTypeConfiguration<RatingScale>
{
    public void Configure(EntityTypeBuilder<RatingScale> builder)
    {
        builder.ToTable("RatingScales");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Version).IsRowVersion();
        builder.HasIndex(x => x.TenantId).IsUnique();
        builder.HasIndex(x => x.CurrentVersionId).IsUnique().HasFilter("\"CurrentVersionId\" IS NOT NULL");
    }
}

public sealed class RatingScaleVersionConfiguration : IEntityTypeConfiguration<RatingScaleVersion>
{
    public void Configure(EntityTypeBuilder<RatingScaleVersion> builder)
    {
        builder.ToTable("RatingScaleVersions");
        builder.HasKey(x => x.Id);
        builder.Ignore(x => x.Levels);
        builder.Property(x => x.Number).IsRequired();
        builder.Property(x => x.LevelsJson).HasColumnName("Levels").HasColumnType("jsonb").IsRequired();
        builder.HasIndex(x => new { x.RatingScaleId, x.Number }).IsUnique();
        builder.HasIndex(x => x.TenantId);
        builder.HasOne<RatingScale>().WithMany().HasForeignKey(x => x.RatingScaleId).OnDelete(DeleteBehavior.Restrict);
    }
}
