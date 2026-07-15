using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class PerformancePlanningReminderConfiguration
    : IEntityTypeConfiguration<PerformancePlanningReminder>
{
    public void Configure(EntityTypeBuilder<PerformancePlanningReminder> builder)
    {
        builder.ToTable("PerformancePlanningReminders");
        builder.HasKey(item => item.Id);

        builder.Property(item => item.TenantId).IsRequired();
        builder.Property(item => item.CycleId).IsRequired();
        builder.Property(item => item.ParticipantEmployeeId);
        builder.Property(item => item.PlanId);
        builder.Property(item => item.TargetEmployeeId).IsRequired();
        builder.Property(item => item.TargetName)
            .HasMaxLength(PerformancePlanningReminder.TargetNameMaxLength)
            .IsRequired();
        builder.Property(item => item.TargetType)
            .HasMaxLength(PerformancePlanningReminder.TargetTypeMaxLength)
            .IsRequired();
        builder.Property(item => item.Reason)
            .HasMaxLength(PerformancePlanningReminder.ReasonMaxLength)
            .IsRequired();
        builder.Property(item => item.RecordedByUserId);
        builder.Property(item => item.RecordedByName).HasMaxLength(256);
        builder.Property(item => item.RecordedAt).IsRequired();
        builder.Property(item => item.NotificationTriggered).IsRequired();
        builder.Property(item => item.CreatedBy).HasMaxLength(256);
        builder.Property(item => item.UpdatedBy).HasMaxLength(256);

        builder.HasOne<PerformanceCycle>()
            .WithMany()
            .HasForeignKey(item => item.CycleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(item => new { item.TenantId, item.CycleId, item.ParticipantEmployeeId, item.RecordedAt })
            .HasDatabaseName("IX_PlanningReminders_Tenant_Cycle_Participant_Time");

        builder.HasIndex(item => new { item.TenantId, item.CycleId, item.TargetEmployeeId, item.RecordedAt })
            .HasDatabaseName("IX_PlanningReminders_Tenant_Cycle_Target_Time");
    }
}
