using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class ObjectiveProgressEntryConfiguration : IEntityTypeConfiguration<ObjectiveProgressEntry>
{
    public void Configure(EntityTypeBuilder<ObjectiveProgressEntry> builder)
    {
        builder.ToTable("ObjectiveProgressEntries");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.TenantId).IsRequired();
        builder.Property(e => e.ObjectiveId).IsRequired();
        builder.Property(e => e.ActorEmployeeId).IsRequired();
        builder.Property(e => e.Mode).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.Source).HasMaxLength(50).IsRequired();
        builder.Property(e => e.Comment).HasMaxLength(1000);
        builder.Property(e => e.ActorName).HasMaxLength(256);
        builder.Property(e => e.PreviousPercent).HasPrecision(5, 2);
        builder.Property(e => e.NewPercent).HasPrecision(5, 2);
        builder.Property(e => e.OccurredAt).IsRequired();
        builder.Property(e => e.CreatedBy).HasMaxLength(256);
        builder.Property(e => e.UpdatedBy).HasMaxLength(256);
        builder.HasIndex(e => new { e.TenantId, e.ObjectiveId })
            .HasDatabaseName("IX_ObjectiveProgressEntries_Tenant_Objective");
        builder.HasIndex(e => new { e.TenantId, e.OccurredAt })
            .HasDatabaseName("IX_ObjectiveProgressEntries_Tenant_OccurredAt");
    }
}
