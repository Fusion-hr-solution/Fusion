using EY.HRPlatform.Performance.Domain.Audit;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class PerformanceAuditEntryConfiguration : IEntityTypeConfiguration<PerformanceAuditEntry>
{
    public void Configure(EntityTypeBuilder<PerformanceAuditEntry> builder)
    {
        builder.ToTable("PerformanceAuditEntries");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.ActorSubject).IsRequired().HasMaxLength(200);
        builder.Property(e => e.ResourceType).IsRequired().HasMaxLength(80);
        builder.Property(e => e.Action).IsRequired().HasMaxLength(100);
        builder.Property(e => e.Summary).IsRequired().HasColumnType("jsonb");
        builder.Property(e => e.CorrelationId).IsRequired().HasMaxLength(200);
        builder.HasIndex(e => new { e.TenantId, e.OccurredAt });
        builder.HasIndex(e => new { e.TenantId, e.ResourceType, e.ResourceId });
        // No resource/Cycle foreign keys: deletion of an unused Draft must retain its audit.
    }
}
