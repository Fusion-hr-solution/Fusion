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
        builder.Property(settings => settings.Version).IsRowVersion();

        builder.Property(settings => settings.DefaultMeasurementMethod).HasConversion<string>().HasMaxLength(30).IsRequired();

        builder.Property(settings => settings.PlanAlignmentPolicy).HasConversion<string>().HasMaxLength(40).IsRequired();

        builder.Property(settings => settings.DefaultSelfAssessmentEnabled).HasDefaultValue(true);
        builder.Property(settings => settings.DefaultObjectiveRatingsEnabled).HasDefaultValue(true);
        builder.Property(settings => settings.DefaultCalibrationEnabled).HasDefaultValue(false);
        builder.Property(settings => settings.EvidenceRetentionMonths).HasDefaultValue(36).IsRequired();
        builder.Property(settings => settings.AiAssistanceEnabled).HasDefaultValue(true);
        builder.Property(settings => settings.DefaultOneOnOneCadence).HasConversion<string>().HasMaxLength(20)
            .HasDefaultValue(EY.HRPlatform.Performance.Domain.Conversations.OneOnOneCadence.EveryTwoWeeks).IsRequired();

        builder.Property(settings => settings.SelfAssessmentDueDays).HasDefaultValue(14);
        builder.Property(settings => settings.PeerInputDueDays).HasDefaultValue(14);
        builder.Property(settings => settings.ManagerAssessmentDueDays).HasDefaultValue(7);
        builder.Property(settings => settings.AcknowledgementReminderDays).HasDefaultValue(7);

        // Exactly one settings row per tenant.
        builder.HasIndex(settings => settings.TenantId).IsUnique();
    }
}
