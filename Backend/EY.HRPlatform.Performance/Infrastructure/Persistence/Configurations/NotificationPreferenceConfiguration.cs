using EY.HRPlatform.Performance.Domain.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class NotificationPreferenceConfiguration : IEntityTypeConfiguration<NotificationPreference>
{
    public void Configure(EntityTypeBuilder<NotificationPreference> builder)
    {
        builder.ToTable("PerformanceNotificationPreferences");
        builder.HasKey(preference => preference.Id);
        builder.Property(preference => preference.Version).IsRowVersion();
        builder.Property(preference => preference.EmailOff).HasColumnType("text[]").IsRequired();

        // One row per recipient in a tenant: by employee record, or by account for someone without one.
        builder.HasIndex(preference => new { preference.TenantId, preference.RecipientEmployeeId })
            .IsUnique().HasFilter("\"RecipientEmployeeId\" IS NOT NULL");
        builder.HasIndex(preference => new { preference.TenantId, preference.RecipientUserId })
            .IsUnique().HasFilter("\"RecipientUserId\" IS NOT NULL");
        builder.ToTable(table => table.HasCheckConstraint("CK_PerformanceNotificationPreferences_Recipient",
            "(\"RecipientEmployeeId\" IS NULL) <> (\"RecipientUserId\" IS NULL)"));
    }
}
