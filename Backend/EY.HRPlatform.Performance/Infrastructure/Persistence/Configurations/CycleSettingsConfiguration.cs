using EY.HRPlatform.Performance.Domain.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class CycleSettingsConfiguration : IEntityTypeConfiguration<CycleSettings>
{
    public void Configure(EntityTypeBuilder<CycleSettings> builder)
    {
        builder.ToTable("CycleSettings");
        builder.HasKey(settings => settings.Id);

        builder.Property(settings => settings.DefaultMeasurementMethod).HasConversion<string>().HasMaxLength(30).IsRequired();

        // Exactly one settings row per tenant.
        builder.HasIndex(settings => settings.TenantId).IsUnique();
    }
}
