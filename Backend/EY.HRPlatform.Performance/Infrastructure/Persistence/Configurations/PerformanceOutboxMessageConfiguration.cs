using EY.HRPlatform.Performance.Domain.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class PerformanceOutboxMessageConfiguration : IEntityTypeConfiguration<PerformanceOutboxMessage>
{
    public void Configure(EntityTypeBuilder<PerformanceOutboxMessage> builder)
    {
        builder.ToTable("PerformanceOutboxMessages");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Kind).HasConversion<string>().HasMaxLength(80);
        builder.Property(m => m.ResourceType).IsRequired().HasMaxLength(80);
        builder.Property(m => m.DedupeKey).IsRequired().HasMaxLength(200);
        builder.Property(m => m.Payload).IsRequired().HasColumnType("jsonb");
        builder.Property(m => m.SkippedReason).HasMaxLength(100);
        builder.Property(m => m.LastError).HasMaxLength(200);
        builder.Ignore(m => m.IsPending);
        builder.HasIndex(m => new { m.TenantId, m.DedupeKey }).IsUnique();
        builder.HasIndex(m => m.NextAttemptAt).HasFilter("\"DispatchedAt\" IS NULL AND \"SkippedReason\" IS NULL");
    }
}
