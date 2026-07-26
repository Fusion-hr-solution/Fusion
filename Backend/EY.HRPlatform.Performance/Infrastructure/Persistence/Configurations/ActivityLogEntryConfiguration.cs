using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class ActivityLogEntryConfiguration : IEntityTypeConfiguration<ActivityLogEntry>
{
    public void Configure(EntityTypeBuilder<ActivityLogEntry> builder)
    {
        builder.ToTable("ActivityLogEntries");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.TenantId).IsRequired();
        builder.Property(a => a.ActorUserId);
        builder.Property(a => a.ActorName).HasMaxLength(256).IsRequired();
        builder.Property(a => a.Action).HasMaxLength(80).IsRequired();
        builder.Property(a => a.SubjectType).HasMaxLength(120).IsRequired();
        builder.Property(a => a.SubjectId).IsRequired();
        builder.Property(a => a.OccurredAt).IsRequired();
        builder.Property(a => a.Metadata).HasColumnType("jsonb");
        builder.Property(a => a.CorrelationId).HasMaxLength(128);
        builder.Property(a => a.CreatedBy).HasMaxLength(256);
        builder.Property(a => a.UpdatedBy).HasMaxLength(256);

        // Primary read path: a subject's history, most-recent-first, within a tenant.
        builder.HasIndex(a => new { a.TenantId, a.SubjectType, a.SubjectId, a.OccurredAt })
            .HasDatabaseName("IX_ActivityLogEntries_Tenant_Subject_OccurredAt");

        builder.HasIndex(a => new { a.TenantId, a.OccurredAt })
            .HasDatabaseName("IX_ActivityLogEntries_Tenant_OccurredAt");
    }
}
