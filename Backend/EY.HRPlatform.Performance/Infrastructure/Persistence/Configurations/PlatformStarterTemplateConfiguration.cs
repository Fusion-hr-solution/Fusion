using EY.HRPlatform.Performance.Domain.Entities.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class PlatformStarterTemplateConfiguration : IEntityTypeConfiguration<PlatformStarterTemplate>
{
    public void Configure(EntityTypeBuilder<PlatformStarterTemplate> builder)
    {
        builder.ToTable("PlatformStarterTemplates");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Title).HasMaxLength(200).IsRequired();
        builder.Property(t => t.Description).HasMaxLength(2000);
        builder.Property(t => t.MeasurementType).HasMaxLength(20).IsRequired().HasDefaultValue("Qualitative");
        builder.Property(t => t.SuggestedWeighting).HasPrecision(5, 2);
        builder.Property(t => t.Tags).HasMaxLength(500);
        builder.Property(t => t.TargetValue).HasPrecision(18, 4);
        builder.Property(t => t.Unit).HasMaxLength(50);
        builder.Property(t => t.SuccessCriteria).HasMaxLength(2000);
        builder.Property(t => t.IsActive).IsRequired().HasDefaultValue(true);
        builder.Property(t => t.SortOrder).IsRequired().HasDefaultValue(0);

        builder.HasIndex(t => t.IsActive).HasDatabaseName("IX_PlatformStarterTemplates_IsActive");
    }
}
