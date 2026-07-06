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
        builder.Property(g => g.MaxObjectivesPerPlan).IsRequired();
        builder.Property(g => g.SupportedAllowedWeightValues)
            .HasMaxLength(500)
            .HasDefaultValue("5,10,15,20,25,30,40,50")
            .IsRequired();
        builder.Property(g => g.QuantitativeAvailable).HasDefaultValue(true).IsRequired();
        builder.Property(g => g.QualitativeAvailable).HasDefaultValue(true).IsRequired();
        builder.Property(g => g.CreatedBy).HasMaxLength(256);
        builder.Property(g => g.UpdatedBy).HasMaxLength(256);

        // No global query filter — platform-scoped entity (D1)
    }
}
