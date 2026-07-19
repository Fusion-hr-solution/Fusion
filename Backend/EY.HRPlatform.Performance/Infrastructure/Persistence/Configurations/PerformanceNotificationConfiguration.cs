using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class PerformanceNotificationConfiguration : IEntityTypeConfiguration<PerformanceNotification>
{
    public void Configure(EntityTypeBuilder<PerformanceNotification> builder)
    {
        builder.ToTable("PerformanceNotifications");
        builder.HasKey(n => n.Id);

        builder.Property(n => n.TenantId).IsRequired();
        builder.Property(n => n.RecipientEmployeeId).IsRequired();

        builder.Property(n => n.Type)
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(n => n.Title).HasMaxLength(200).IsRequired();
        builder.Property(n => n.Message).HasMaxLength(2000);
        builder.Property(n => n.DedupKey).HasMaxLength(200);
        builder.Property(n => n.SubjectType).HasMaxLength(120);
        builder.Property(n => n.NavigationRoute).HasMaxLength(400);
        builder.Property(n => n.CreatedBy).HasMaxLength(256);
        builder.Property(n => n.UpdatedBy).HasMaxLength(256);

        builder.Ignore(n => n.IsRead);

        builder.HasIndex(n => new { n.TenantId, n.RecipientEmployeeId, n.ReadAt })
            .HasDatabaseName("IX_PerformanceNotifications_Tenant_Recipient_Read");

        // Idempotency for generated reminders: at most one notification per dedup key.
        builder.HasIndex(n => new { n.TenantId, n.DedupKey })
            .IsUnique()
            .HasFilter("\"DedupKey\" IS NOT NULL")
            .HasDatabaseName("IX_PerformanceNotifications_Tenant_DedupKey");
    }
}
