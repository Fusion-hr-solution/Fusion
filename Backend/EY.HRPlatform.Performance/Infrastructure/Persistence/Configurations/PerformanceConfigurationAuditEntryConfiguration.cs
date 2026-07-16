using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class PerformanceConfigurationAuditEntryConfiguration : IEntityTypeConfiguration<PerformanceConfigurationAuditEntry>
{
    public void Configure(EntityTypeBuilder<PerformanceConfigurationAuditEntry> builder)
    {
        builder.ToTable("PerformanceConfigurationAuditEntries");
        builder.HasKey(a => a.Id);

        // TenantId is null for platform-scoped entries — no query filter applied (see DbContext).
        builder.Property(a => a.TenantId);
        builder.Property(a => a.Scope).HasMaxLength(10).IsRequired();
        builder.Property(a => a.ActorUserId);
        builder.Property(a => a.ActorName).HasMaxLength(256);
        builder.Property(a => a.Action).HasMaxLength(60).IsRequired();
        builder.Property(a => a.EntityType).HasMaxLength(80).IsRequired();
        builder.Property(a => a.EntityId).IsRequired();
        builder.Property(a => a.VersionNumber);
        builder.Property(a => a.OccurredAt).IsRequired();
        builder.Property(a => a.PreviousValue).HasMaxLength(2000);
        builder.Property(a => a.NewValue).HasMaxLength(2000);
        builder.Property(a => a.Reason).HasMaxLength(500);
        builder.Property(a => a.CorrelationId).HasMaxLength(128);
        builder.Property(a => a.CreatedBy).HasMaxLength(256);
        builder.Property(a => a.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(a => a.OccurredAt)
            .HasDatabaseName("IX_PerformanceConfigurationAudit_OccurredAt");
        builder.HasIndex(a => new { a.TenantId, a.OccurredAt })
            .HasDatabaseName("IX_PerformanceConfigurationAudit_Tenant_OccurredAt");

        builder.HasIndex(a => new { a.Scope, a.OccurredAt })
            .HasDatabaseName("IX_PerformanceConfigurationAudit_Scope_OccurredAt");

        builder.HasIndex(a => new { a.EntityType, a.EntityId })
            .HasDatabaseName("IX_PerformanceConfigurationAudit_Entity");

    }
}
