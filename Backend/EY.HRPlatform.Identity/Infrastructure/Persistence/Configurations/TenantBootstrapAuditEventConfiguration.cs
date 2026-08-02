using EY.HRPlatform.Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Configurations;

public class TenantBootstrapAuditEventConfiguration : IEntityTypeConfiguration<TenantBootstrapAuditEvent>
{
    public void Configure(EntityTypeBuilder<TenantBootstrapAuditEvent> builder)
    {
        builder.ToTable("TenantBootstrapAuditEvents");

        builder.HasKey(auditEvent => auditEvent.Id);

        builder.Property(auditEvent => auditEvent.EventType)
            .HasConversion<string>()
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(auditEvent => auditEvent.Outcome)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(auditEvent => auditEvent.Reason)
            .HasMaxLength(128);

        builder.Property(auditEvent => auditEvent.Metadata)
            .HasMaxLength(TenantBootstrapAuditEvent.MetadataMaxLength);

        builder.Property(auditEvent => auditEvent.OccurredAt)
            .IsRequired();

        builder.Property(auditEvent => auditEvent.CorrelationId)
            .IsRequired();

        // Tenant bootstrap history is read in reverse chronological order.
        builder.HasIndex(auditEvent => new { auditEvent.TenantId, auditEvent.OccurredAt })
            .HasDatabaseName("IX_TenantBootstrapAuditEvents_TenantId_OccurredAt");

        builder.HasIndex(auditEvent => auditEvent.CorrelationId);

        // History outlives the records it describes, so no foreign key cascades
        // bootstrap history away.
        builder.HasIndex(auditEvent => auditEvent.InvitationId);
    }
}
