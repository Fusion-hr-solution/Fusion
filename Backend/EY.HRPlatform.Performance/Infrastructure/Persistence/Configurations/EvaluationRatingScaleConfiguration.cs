using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class EvaluationRatingScaleConfiguration : IEntityTypeConfiguration<EvaluationRatingScale>
{
    public void Configure(EntityTypeBuilder<EvaluationRatingScale> builder)
    {
        builder.ToTable("EvaluationRatingScales");
        builder.HasKey(scale => scale.Id);
        builder.Property(scale => scale.Version).IsRowVersion();
        builder.Property(scale => scale.TenantId).IsRequired();
        builder.Property(scale => scale.Name).HasMaxLength(EvaluationRatingScale.NameMaxLength).IsRequired();
        builder.Property(scale => scale.Description).HasMaxLength(EvaluationRatingScale.DescriptionMaxLength);
        builder.Property(scale => scale.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(EvaluationConfigStatus.Draft)
            .IsRequired();
        builder.Property(scale => scale.IsInUse).HasDefaultValue(false).IsRequired();
        builder.Property(scale => scale.CreatedBy).HasMaxLength(256);
        builder.Property(scale => scale.UpdatedBy).HasMaxLength(256);

        builder.HasMany(scale => scale.Levels)
            .WithOne()
            .HasForeignKey(level => level.RatingScaleId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(EvaluationRatingScale.Levels))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(scale => new { scale.TenantId, scale.Status });
        builder.HasIndex(scale => new { scale.TenantId, scale.Name, scale.Status });
        builder.HasIndex(scale => new { scale.TenantId, scale.Name })
            .IsUnique()
            .HasFilter("\"Status\" = 'Active'")
            .HasDatabaseName("UX_EvaluationRatingScales_Tenant_ActiveName");
        builder.Ignore(scale => scale.DomainEvents);
    }
}

public sealed class EvaluationRatingScaleLevelConfiguration : IEntityTypeConfiguration<EvaluationRatingScaleLevel>
{
    public void Configure(EntityTypeBuilder<EvaluationRatingScaleLevel> builder)
    {
        builder.ToTable("EvaluationRatingScaleLevels");
        builder.HasKey(level => level.Id);
        builder.Property(level => level.TenantId).IsRequired();
        builder.Property(level => level.RatingScaleId).IsRequired();
        builder.Property(level => level.Ordinal).IsRequired();
        builder.Property(level => level.Label).HasMaxLength(EvaluationRatingScaleLevel.LabelMaxLength).IsRequired();
        builder.Property(level => level.Description).HasMaxLength(EvaluationRatingScaleLevel.DescriptionMaxLength);
        builder.Property(level => level.BehavioralGuidance).HasMaxLength(EvaluationRatingScaleLevel.BehavioralGuidanceMaxLength);
        builder.HasIndex(level => new { level.TenantId, level.RatingScaleId, level.Ordinal }).IsUnique();
        builder.Ignore(level => level.Value);
    }
}
