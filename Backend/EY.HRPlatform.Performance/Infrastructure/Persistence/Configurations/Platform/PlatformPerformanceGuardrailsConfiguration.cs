using EY.HRPlatform.Performance.Domain.Entities.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations.Platform;

public class PlatformPerformanceGuardrailsConfiguration : IEntityTypeConfiguration<PlatformPerformanceGuardrails>
{
    public void Configure(EntityTypeBuilder<PlatformPerformanceGuardrails> builder)
    {
        builder.ToTable("PlatformPerformanceGuardrails");
        builder.HasKey(g => g.Id);

        builder.Property(g => g.Version).IsRowVersion();
        builder.Property(g => g.MinObjectivesPerPlan).IsRequired();
        builder.Property(g => g.MaxObjectivesPerPlan).IsRequired();
        builder.Property(g => g.MinManagerValidationSlaDays).IsRequired();
        builder.Property(g => g.MaxManagerValidationSlaDays).IsRequired();
        builder.Property(g => g.PermittedWeightDecimalPlaces).IsRequired();
        builder.Property(g => g.MaxAllowedWeightingValues).IsRequired();
        builder.Property(g => g.SupportedMeasurementTypes).HasMaxLength(100).IsRequired();
        builder.Property(g => g.MaxTemplateTitleLength).IsRequired();
        builder.Property(g => g.MaxTemplateDescriptionLength).IsRequired();
        builder.Property(g => g.MaxTemplateTags).IsRequired();
        builder.Property(g => g.CreatedBy).HasMaxLength(256);
        builder.Property(g => g.UpdatedBy).HasMaxLength(256);

        // No global query filter — platform-scoped entity (D1)
    }
}
