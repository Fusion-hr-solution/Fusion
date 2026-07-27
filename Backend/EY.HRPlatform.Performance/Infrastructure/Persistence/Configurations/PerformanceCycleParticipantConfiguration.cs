using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class PerformanceCycleParticipantConfiguration : IEntityTypeConfiguration<PerformanceCycleParticipant>
{
    public void Configure(EntityTypeBuilder<PerformanceCycleParticipant> builder)
    {
        builder.ToTable("PerformanceCycleParticipants");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.TenantId).IsRequired();
        builder.Property(p => p.CycleId).IsRequired();
        builder.Property(p => p.EmployeeId).IsRequired();

        builder.Property(p => p.EmployeeKey).HasMaxLength(64);
        builder.Property(p => p.FullName).HasMaxLength(256).IsRequired();
        builder.Property(p => p.Email).HasMaxLength(256);
        builder.Property(p => p.OrgUnitName).HasMaxLength(200);
        builder.Property(p => p.JobTitle).HasMaxLength(150);
        builder.Property(p => p.ManagerName).HasMaxLength(256);
        builder.Property(p => p.ApproverEmployeeId).IsRequired();
        builder.Property(p => p.ApproverName).HasMaxLength(256).IsRequired();
        builder.Property(p => p.ApproverOverrideReason).HasMaxLength(500);
        builder.Property(p => p.SnapshotAt).IsRequired();
        builder.Property(p => p.CreatedBy).HasMaxLength(256);
        builder.Property(p => p.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(p => p.TenantId)
            .HasDatabaseName("IX_PerformanceCycleParticipants_TenantId");

        builder.HasIndex(p => new { p.CycleId, p.EmployeeId })
            .IsUnique()
            .HasDatabaseName("IX_PerformanceCycleParticipants_Cycle_Employee");

        // Supports the reviewer-scoped read: a manager's participants resolve from the index
        // rather than from a scan of the campaign's whole frozen population.
        builder.HasIndex(p => new { p.CycleId, p.ApproverEmployeeId })
            .HasDatabaseName("IX_PerformanceCycleParticipants_Cycle_Approver");
    }
}
