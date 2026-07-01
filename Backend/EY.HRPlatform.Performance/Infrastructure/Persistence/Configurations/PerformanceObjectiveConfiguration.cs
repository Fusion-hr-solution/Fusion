using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class PerformanceObjectiveConfiguration : IEntityTypeConfiguration<PerformanceObjective>
{
    public void Configure(EntityTypeBuilder<PerformanceObjective> builder)
    {
        builder.ToTable("PerformanceObjectives");
        builder.HasKey(objective => objective.Id);
        builder.Property(objective => objective.Version).IsRowVersion();
        builder.Property(objective => objective.Title).HasMaxLength(200).IsRequired();
        builder.Property(objective => objective.Description).HasMaxLength(2000);
        builder.Property(objective => objective.SuccessMeasure).HasMaxLength(500).IsRequired();
        builder.Property(objective => objective.Target).HasMaxLength(500).IsRequired();
        builder.Property(objective => objective.Weight).HasPrecision(5, 2);
        builder.Property(objective => objective.Level).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(objective => objective.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(objective => objective.ProgressMode).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(objective => objective.ManualProgressPercent).HasPrecision(5, 2);
        builder.HasIndex(objective => new { objective.TenantId, objective.CycleId, objective.OwnerEmployeeId });
        builder.HasIndex(objective => new { objective.CycleId, objective.ParentObjectiveId });
        builder.Ignore(objective => objective.DomainEvents);
    }
}
