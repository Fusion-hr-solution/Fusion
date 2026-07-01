using EY.HRPlatform.Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Configurations;

public class AccessAuditEventConfiguration : IEntityTypeConfiguration<AccessAuditEvent>
{
    public void Configure(EntityTypeBuilder<AccessAuditEvent> builder)
    {
        builder.ToTable("AccessAuditEvents");
        builder.HasKey(auditEvent => auditEvent.Id);

        builder.Property(auditEvent => auditEvent.TenantId).IsRequired();
        builder.Property(auditEvent => auditEvent.OccurredAt).IsRequired();
        builder.Property(auditEvent => auditEvent.ActorName).HasMaxLength(200).IsRequired();
        builder.Property(auditEvent => auditEvent.ActorRole).HasMaxLength(100).IsRequired();
        builder.Property(auditEvent => auditEvent.Action).HasMaxLength(100).IsRequired();
        builder.Property(auditEvent => auditEvent.ResourceType).HasMaxLength(120).IsRequired();
        builder.Property(auditEvent => auditEvent.ResourceId).HasMaxLength(120);
        builder.Property(auditEvent => auditEvent.Summary).HasMaxLength(500).IsRequired();
        builder.Property(auditEvent => auditEvent.BeforeJson).HasColumnType("jsonb");
        builder.Property(auditEvent => auditEvent.AfterJson).HasColumnType("jsonb");
        builder.Property(auditEvent => auditEvent.CorrelationId).HasMaxLength(100);
        builder.Property(auditEvent => auditEvent.CreatedBy).HasMaxLength(256);
        builder.Property(auditEvent => auditEvent.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(auditEvent => new { auditEvent.TenantId, auditEvent.OccurredAt })
            .HasDatabaseName("IX_AccessAuditEvents_TenantId_OccurredAt");

        builder.HasIndex(auditEvent => new { auditEvent.TenantId, auditEvent.ResourceType, auditEvent.ResourceId })
            .HasDatabaseName("IX_AccessAuditEvents_TenantId_Resource");
    }
}
