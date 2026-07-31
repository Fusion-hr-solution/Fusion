using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class PerformanceCyclePopulationRuleConfiguration : IEntityTypeConfiguration<PerformanceCyclePopulationRule>
{
    public void Configure(EntityTypeBuilder<PerformanceCyclePopulationRule> builder)
    {
        builder.ToTable("PerformanceCyclePopulationRules");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.TenantId).IsRequired();
        builder.Property(r => r.CycleId).IsRequired();

        builder.Property(r => r.RuleType)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(r => r.RefId).IsRequired();
        builder.Property(r => r.Reason).HasMaxLength(500);
        builder.Property(r => r.CreatedBy).HasMaxLength(256);
        builder.Property(r => r.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(r => r.TenantId)
            .HasDatabaseName("IX_PerformanceCyclePopulationRules_TenantId");

        builder.HasIndex(r => new { r.CycleId, r.RuleType, r.RefId })
            .IsUnique()
            .HasDatabaseName("IX_PerformanceCyclePopulationRules_Cycle_Type_Ref");
    }
}
