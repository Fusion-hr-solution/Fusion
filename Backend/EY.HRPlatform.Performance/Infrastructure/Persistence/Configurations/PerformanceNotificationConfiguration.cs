using EY.HRPlatform.Performance.Domain.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class PerformanceNotificationConfiguration : IEntityTypeConfiguration<PerformanceNotification>
{
    public void Configure(EntityTypeBuilder<PerformanceNotification> builder)
    {
        builder.ToTable("PerformanceNotifications");
        builder.HasKey(n => n.Id);
        builder.Property(n => n.Kind).HasConversion<string>().HasMaxLength(80);
        builder.Property(n => n.ResourceType).IsRequired().HasMaxLength(80);
        builder.Property(n => n.Title).IsRequired().HasMaxLength(300);
        builder.Property(n => n.Context).HasMaxLength(500);
        builder.Property(n => n.ActorName).HasMaxLength(200);
        builder.Property(n => n.Href).IsRequired().HasMaxLength(500);
        builder.Property(n => n.DedupeKey).IsRequired().HasMaxLength(200);
        builder.HasIndex(n => new { n.TenantId, n.DedupeKey }).IsUnique();
        builder.HasIndex(n => new { n.TenantId, n.RecipientEmployeeId, n.OccurredAt }).IsDescending(false, false, true);
        builder.HasIndex(n => new { n.TenantId, n.RecipientUserId, n.OccurredAt }).IsDescending(false, false, true);
        builder.HasIndex(n => n.OccurredAt);
    }
}
