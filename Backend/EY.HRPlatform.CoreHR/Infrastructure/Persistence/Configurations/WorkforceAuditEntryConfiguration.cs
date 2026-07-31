using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public sealed class WorkforceAuditEntryConfiguration : IEntityTypeConfiguration<WorkforceAuditEntry>
{
    public void Configure(EntityTypeBuilder<WorkforceAuditEntry> builder)
    {
        builder.ToTable("WorkforceAuditEntries");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.TenantId).IsRequired();
        builder.Property(x => x.EntityType).HasMaxLength(50).IsRequired();
        builder.Property(x => x.EntityId).IsRequired();
        builder.Property(x => x.Action).HasConversion<string>().HasMaxLength(40).IsRequired();
        builder.Property(x => x.Actor).HasMaxLength(256);
        builder.Property(x => x.OccurredAt).IsRequired();
        builder.Property(x => x.EffectiveDate);
        builder.Property(x => x.Source).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(x => x.SourceReference).HasMaxLength(256);
        builder.Property(x => x.ChangeDetails).HasMaxLength(2000);

        builder.Property(x => x.CreatedBy).HasMaxLength(256);
        builder.Property(x => x.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(x => new { x.TenantId, x.EntityType, x.EntityId })
            .HasDatabaseName("IX_WorkforceAuditEntries_Tenant_Entity");
        builder.HasIndex(x => new { x.TenantId, x.OccurredAt })
            .HasDatabaseName("IX_WorkforceAuditEntries_Tenant_OccurredAt");
    }
}
