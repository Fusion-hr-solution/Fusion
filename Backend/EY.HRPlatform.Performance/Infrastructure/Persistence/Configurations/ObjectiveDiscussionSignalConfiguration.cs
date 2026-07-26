using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class ObjectiveDiscussionSignalConfiguration : IEntityTypeConfiguration<ObjectiveDiscussionSignal>
{
    public void Configure(EntityTypeBuilder<ObjectiveDiscussionSignal> builder)
    {
        builder.ToTable("ObjectiveDiscussionSignals");
        builder.HasKey(signal => signal.Id);

        builder.Property(signal => signal.Version).IsRowVersion();
        builder.Property(signal => signal.TenantId).IsRequired();
        builder.Property(signal => signal.CycleId).IsRequired();
        builder.Property(signal => signal.PlanId).IsRequired();
        builder.Property(signal => signal.ObjectiveId).IsRequired();
        builder.Property(signal => signal.RaisedByEmployeeId).IsRequired();
        builder.Property(signal => signal.ObjectiveTitle).HasMaxLength(EmployeeObjective.TitleMaxLength).IsRequired();
        builder.Property(signal => signal.Note).HasMaxLength(ObjectiveDiscussionSignal.NoteMaxLength);
        builder.Property(signal => signal.Status)
            .HasConversion<int>()
            .IsRequired()
            .HasDefaultValue(DiscussionSignalStatus.Open);
        builder.Property(signal => signal.LinkedCheckInId);
        builder.Property(signal => signal.ResolvedByCheckInId);
        builder.Property(signal => signal.CloseReason).HasMaxLength(ObjectiveDiscussionSignal.CloseReasonMaxLength);
        builder.Property(signal => signal.RaisedAt).IsRequired();
        builder.Property(signal => signal.ResolvedAt);
        builder.Property(signal => signal.CreatedBy).HasMaxLength(256);
        builder.Property(signal => signal.UpdatedBy).HasMaxLength(256);

        builder.HasOne<EmployeeObjectivePlan>()
            .WithMany()
            .HasForeignKey(signal => signal.PlanId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(signal => new { signal.TenantId, signal.CycleId, signal.ObjectiveId, signal.Status })
            .HasDatabaseName("IX_ObjectiveDiscussionSignals_Tenant_Cycle_Objective_Status");
        builder.HasIndex(signal => new { signal.TenantId, signal.CycleId, signal.RaisedByEmployeeId, signal.Status })
            .HasDatabaseName("IX_ObjectiveDiscussionSignals_Tenant_Cycle_Employee_Status");
        builder.HasIndex(signal => signal.LinkedCheckInId)
            .HasDatabaseName("IX_ObjectiveDiscussionSignals_LinkedCheckIn");

        builder.Ignore(signal => signal.DomainEvents);
    }
}
