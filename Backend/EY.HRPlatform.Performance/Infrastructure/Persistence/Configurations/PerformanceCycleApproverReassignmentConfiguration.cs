using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class PerformanceCycleApproverReassignmentConfiguration
    : IEntityTypeConfiguration<PerformanceCycleApproverReassignment>
{
    public void Configure(EntityTypeBuilder<PerformanceCycleApproverReassignment> builder)
    {
        builder.ToTable("PerformanceCycleApproverReassignments");
        builder.HasKey(item => item.Id);

        builder.Property(item => item.TenantId).IsRequired();
        builder.Property(item => item.CycleId).IsRequired();
        builder.Property(item => item.ParticipantEmployeeId).IsRequired();
        builder.Property(item => item.PreviousApproverEmployeeId);
        builder.Property(item => item.PreviousApproverName).HasMaxLength(256);
        builder.Property(item => item.NewApproverEmployeeId).IsRequired();
        builder.Property(item => item.NewApproverName).HasMaxLength(256).IsRequired();
        builder.Property(item => item.Reason)
            .HasMaxLength(PerformanceCycleApproverReassignment.ReasonMaxLength)
            .IsRequired();
        builder.Property(item => item.ReassignedByUserId);
        builder.Property(item => item.ReassignedByName).HasMaxLength(256);
        builder.Property(item => item.ReassignedAt).IsRequired();
        builder.Property(item => item.CreatedBy).HasMaxLength(256);
        builder.Property(item => item.UpdatedBy).HasMaxLength(256);

        builder.HasOne<PerformanceCycle>()
            .WithMany()
            .HasForeignKey(item => item.CycleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<PerformanceCycleParticipant>()
            .WithMany()
            .HasForeignKey(item => new { item.CycleId, item.ParticipantEmployeeId })
            .HasPrincipalKey(participant => new { participant.CycleId, participant.EmployeeId })
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(item => new { item.TenantId, item.CycleId, item.ParticipantEmployeeId, item.ReassignedAt })
            .HasDatabaseName("IX_ApproverReassignments_Tenant_Cycle_Participant_Time");

        builder.HasIndex(item => new { item.TenantId, item.CycleId, item.NewApproverEmployeeId })
            .HasDatabaseName("IX_ApproverReassignments_Tenant_Cycle_NewApprover");
    }
}
