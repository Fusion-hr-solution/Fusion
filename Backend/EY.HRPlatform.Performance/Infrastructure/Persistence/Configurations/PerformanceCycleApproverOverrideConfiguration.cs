using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class PerformanceCycleApproverOverrideConfiguration : IEntityTypeConfiguration<PerformanceCycleApproverOverride>
{
    public void Configure(EntityTypeBuilder<PerformanceCycleApproverOverride> builder)
    {
        builder.ToTable("PerformanceCycleApproverOverrides");
        builder.HasKey(o => o.Id);

        builder.Property(o => o.TenantId).IsRequired();
        builder.Property(o => o.CycleId).IsRequired();
        builder.Property(o => o.ParticipantEmployeeId).IsRequired();
        builder.Property(o => o.ApproverEmployeeId).IsRequired();
        builder.Property(o => o.ApproverName).HasMaxLength(256).IsRequired();
        builder.Property(o => o.Reason).HasMaxLength(500).IsRequired();
        builder.Property(o => o.CreatedBy).HasMaxLength(256);
        builder.Property(o => o.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(o => o.TenantId)
            .HasDatabaseName("IX_PerformanceCycleApproverOverrides_TenantId");

        builder.HasIndex(o => new { o.CycleId, o.ParticipantEmployeeId })
            .IsUnique()
            .HasDatabaseName("IX_PerformanceCycleApproverOverrides_Cycle_Participant");
    }
}
