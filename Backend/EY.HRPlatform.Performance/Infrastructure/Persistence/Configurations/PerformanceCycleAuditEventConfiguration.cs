using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class PerformanceCycleAuditEventConfiguration : IEntityTypeConfiguration<PerformanceCycleAuditEvent>
{
    public void Configure(EntityTypeBuilder<PerformanceCycleAuditEvent> builder)
    {
        builder.ToTable("PerformanceCycleAuditEvents");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.TenantId).IsRequired();
        builder.Property(a => a.CycleId).IsRequired();

        builder.Property(a => a.Action)
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(a => a.ActorName).HasMaxLength(256);
        builder.Property(a => a.Details).HasMaxLength(2000);
        builder.Property(a => a.Outcome).HasMaxLength(20);
        builder.Property(a => a.CorrelationId).HasMaxLength(128);
        builder.Property(a => a.OccurredAt).IsRequired();
        builder.Property(a => a.CreatedBy).HasMaxLength(256);
        builder.Property(a => a.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(a => new { a.TenantId, a.CycleId })
            .HasDatabaseName("IX_PerformanceCycleAuditEvents_Tenant_Cycle");

        builder.HasIndex(a => new { a.TenantId, a.OccurredAt })
            .HasDatabaseName("IX_PerformanceCycleAuditEvents_Tenant_OccurredAt");
    }
}
