using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class PerformanceCycleParticipantExclusionConfiguration
    : IEntityTypeConfiguration<PerformanceCycleParticipantExclusion>
{
    public void Configure(EntityTypeBuilder<PerformanceCycleParticipantExclusion> builder)
    {
        builder.ToTable("PerformanceCycleParticipantExclusions");
        builder.HasKey(item => item.Id);

        builder.Property(item => item.TenantId).IsRequired();
        builder.Property(item => item.CycleId).IsRequired();
        builder.Property(item => item.ParticipantEmployeeId).IsRequired();
        builder.Property(item => item.Reason)
            .HasMaxLength(PerformanceCycleParticipantExclusion.ReasonMaxLength)
            .IsRequired();
        builder.Property(item => item.ExcludedByUserId);
        builder.Property(item => item.ExcludedByName).HasMaxLength(256);
        builder.Property(item => item.ExcludedAt).IsRequired();
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

        builder.HasIndex(item => new { item.TenantId, item.CycleId, item.ParticipantEmployeeId })
            .IsUnique()
            .HasDatabaseName("IX_ParticipantExclusions_Tenant_Cycle_Participant");

        builder.HasIndex(item => new { item.TenantId, item.CycleId })
            .HasDatabaseName("IX_ParticipantExclusions_Tenant_Cycle");
    }
}
