using EY.HRPlatform.Performance.Domain.Progress;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class ProgressUpdateConfiguration : IEntityTypeConfiguration<ProgressUpdate>
{
    public void Configure(EntityTypeBuilder<ProgressUpdate> builder)
    {
        builder.ToTable("ProgressUpdates");
        builder.HasKey(update => update.Id);
        builder.Property(update => update.Version).IsRowVersion();

        builder.Property(update => update.Kind).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(update => update.Value).HasColumnType("numeric(18,4)");
        builder.Property(update => update.ContextNote).HasMaxLength(2000);
        builder.Property(update => update.Status).HasConversion<string>().HasMaxLength(20);

        builder.HasIndex(update => update.TenantId);
        builder.HasIndex(update => update.ObjectiveId);
        builder.HasIndex(update => update.CycleId);

        builder.HasMany(update => update.Evidence)
            .WithOne()
            .HasForeignKey(item => item.ProgressUpdateId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(update => update.Evidence).AutoInclude(false);

        builder.HasMany(update => update.MilestoneChanges)
            .WithOne()
            .HasForeignKey(change => change.ProgressUpdateId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(update => update.MilestoneChanges).AutoInclude();
    }
}

public sealed class ProgressMilestoneChangeConfiguration : IEntityTypeConfiguration<ProgressMilestoneChange>
{
    public void Configure(EntityTypeBuilder<ProgressMilestoneChange> builder)
    {
        builder.ToTable("ProgressMilestoneChanges");
        builder.HasKey(change => change.Id);
        builder.HasIndex(change => change.ProgressUpdateId);
        builder.HasIndex(change => change.MilestoneId);
    }
}

public sealed class EvidenceItemConfiguration : IEntityTypeConfiguration<EvidenceItem>
{
    public void Configure(EntityTypeBuilder<EvidenceItem> builder)
    {
        builder.ToTable("EvidenceItems");
        builder.HasKey(item => item.Id);

        builder.Property(item => item.Kind).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(item => item.FileName).HasMaxLength(400);
        builder.Property(item => item.ContentType).HasMaxLength(200);
        builder.Property(item => item.StorageKey).HasMaxLength(400);
        builder.Property(item => item.IsRemovedUnderRetention).HasDefaultValue(false).IsRequired();
        builder.Property(item => item.Url).HasMaxLength(2000);
        builder.Property(item => item.ReferenceText).HasMaxLength(1000);

        builder.HasIndex(item => item.ProgressUpdateId);
    }
}
