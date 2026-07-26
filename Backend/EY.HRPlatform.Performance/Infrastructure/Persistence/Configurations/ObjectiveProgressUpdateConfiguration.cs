using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class ObjectiveProgressUpdateConfiguration : IEntityTypeConfiguration<ObjectiveProgressUpdate>
{
    public void Configure(EntityTypeBuilder<ObjectiveProgressUpdate> builder)
    {
        builder.ToTable("ObjectiveProgressUpdates");
        builder.HasKey(update => update.Id);

        builder.Property(update => update.TenantId).IsRequired();
        builder.Property(update => update.CycleId).IsRequired();
        builder.Property(update => update.PlanId).IsRequired();
        builder.Property(update => update.ObjectiveId).IsRequired();
        builder.Property(update => update.EmployeeId).IsRequired();
        builder.Property(update => update.ProgressPercent).IsRequired();
        builder.Property(update => update.PreviousPercent);
        builder.Property(update => update.ActualValue)
            .HasMaxLength(ObjectiveProgressUpdate.ActualValueMaxLength);
        builder.Property(update => update.Comment)
            .HasMaxLength(ObjectiveProgressUpdate.CommentMaxLength);
        builder.Property(update => update.IsRegression).IsRequired();
        builder.Property(update => update.RegressionReason)
            .HasMaxLength(ObjectiveProgressUpdate.RegressionReasonMaxLength);
        builder.Property(update => update.ActorUserId).IsRequired();
        builder.Property(update => update.ActorName).HasMaxLength(256).IsRequired();
        builder.Property(update => update.RecordedAt).IsRequired();
        builder.Property(update => update.CreatedBy).HasMaxLength(256);
        builder.Property(update => update.UpdatedBy).HasMaxLength(256);

        builder.HasOne<EmployeeObjectivePlan>()
            .WithMany()
            .HasForeignKey(update => update.PlanId)
            .OnDelete(DeleteBehavior.Cascade);

        // Primary read path: latest-per-objective and an objective's history, most-recent-first.
        builder.HasIndex(update => new { update.ObjectiveId, update.RecordedAt, update.Id })
            .HasDatabaseName("IX_ObjectiveProgressUpdates_Objective_RecordedAt");

        builder.HasIndex(update => new { update.TenantId, update.PlanId })
            .HasDatabaseName("IX_ObjectiveProgressUpdates_Tenant_Plan");

        builder.HasIndex(update => new { update.TenantId, update.CycleId })
            .HasDatabaseName("IX_ObjectiveProgressUpdates_Tenant_Cycle");
    }
}
