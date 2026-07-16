using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class EmployeeObjectivePlanConfiguration : IEntityTypeConfiguration<EmployeeObjectivePlan>
{
    public void Configure(EntityTypeBuilder<EmployeeObjectivePlan> builder)
    {
        builder.ToTable("EmployeeObjectivePlans");
        builder.HasKey(plan => plan.Id);

        builder.Property(plan => plan.Version).IsRowVersion();
        builder.Property(plan => plan.TenantId).IsRequired();
        builder.Property(plan => plan.CycleId).IsRequired();
        builder.Property(plan => plan.EmployeeId).IsRequired();
        builder.Property(plan => plan.Status)
            .HasConversion<int>()
            .IsRequired()
            .HasDefaultValue(PlanStatus.Draft);
        builder.Property(plan => plan.SubmittedAt);
        builder.Property(plan => plan.ApproverEmployeeId);
        builder.Property(plan => plan.ApproverName).HasMaxLength(256);
        builder.Property(plan => plan.ApprovingManagerEmployeeId);
        builder.Property(plan => plan.ApprovingManagerName).HasMaxLength(256);
        builder.Property(plan => plan.ApprovedAt);
        builder.Property(plan => plan.CreatedBy).HasMaxLength(256);
        builder.Property(plan => plan.UpdatedBy).HasMaxLength(256);

        builder.HasOne<PerformanceCycle>()
            .WithMany()
            .HasForeignKey(plan => plan.CycleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<PerformanceCycleParticipant>()
            .WithMany()
            .HasForeignKey(plan => new { plan.CycleId, plan.EmployeeId })
            .HasPrincipalKey(participant => new { participant.CycleId, participant.EmployeeId })
            .OnDelete(DeleteBehavior.Restrict);

        builder.OwnsMany(plan => plan.Objectives, objective =>
        {
            objective.ToTable("EmployeeObjectives");
            objective.WithOwner().HasForeignKey(item => item.PlanId);
            objective.HasKey(item => item.Id);
            objective.Property(item => item.PlanId).IsRequired();
            objective.Property(item => item.Title)
                .HasMaxLength(EmployeeObjective.TitleMaxLength)
                .IsRequired();
            objective.Property(item => item.Description)
                .HasMaxLength(EmployeeObjective.DescriptionMaxLength);
            objective.Property(item => item.AlignmentType)
                .HasConversion<string>()
                .HasMaxLength(32);
            objective.Property(item => item.AlignmentTargetId);
            objective.Property(item => item.AlignmentTitle)
                .HasMaxLength(EmployeeObjective.AlignmentTitleMaxLength);
            objective.Property(item => item.Weight);
            objective.Property(item => item.Deadline);
            objective.Property(item => item.MeasurementMethod)
                .HasMaxLength(EmployeeObjective.MeasurementMethodMaxLength);
            objective.Property(item => item.MeasurementIndicator)
                .HasMaxLength(EmployeeObjective.MeasurementIndicatorMaxLength);
            objective.Property(item => item.TargetValue)
                .HasMaxLength(EmployeeObjective.TargetValueMaxLength);
            objective.Property(item => item.TargetUnit)
                .HasMaxLength(EmployeeObjective.TargetUnitMaxLength);
            objective.Property(item => item.SuccessCriteria)
                .HasMaxLength(EmployeeObjective.SuccessCriteriaMaxLength);
            objective.Property(item => item.CreatedBy).HasMaxLength(256);
            objective.Property(item => item.UpdatedBy).HasMaxLength(256);

            objective.HasIndex(item => item.PlanId)
                .HasDatabaseName("IX_EmployeeObjectives_Plan");
            objective.HasIndex(item => new { item.AlignmentType, item.AlignmentTargetId })
                .HasDatabaseName("IX_EmployeeObjectives_Alignment");
        });

        builder.Metadata.FindNavigation(nameof(EmployeeObjectivePlan.Objectives))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.OwnsMany(plan => plan.ReviewEvents, reviewEvent =>
        {
            reviewEvent.ToTable("EmployeeObjectivePlanReviewEvents");
            reviewEvent.WithOwner().HasForeignKey(item => item.PlanId);
            reviewEvent.HasKey(item => item.Id);
            reviewEvent.Property(item => item.PlanId).IsRequired();
            reviewEvent.Property(item => item.ActorEmployeeId).IsRequired();
            reviewEvent.Property(item => item.ActorName)
                .HasMaxLength(EmployeeObjectivePlanReviewEvent.ActorNameMaxLength)
                .IsRequired();
            reviewEvent.Property(item => item.Type)
                .HasConversion<int>()
                .IsRequired();
            reviewEvent.Property(item => item.Comment)
                .HasMaxLength(EmployeeObjectivePlanReviewEvent.CommentMaxLength);
            reviewEvent.Property(item => item.ReferencedObjectiveIds)
                .HasColumnType("uuid[]")
                .IsRequired();
            reviewEvent.Property(item => item.OccurredAt).IsRequired();
            reviewEvent.Property(item => item.CreatedBy).HasMaxLength(256);
            reviewEvent.Property(item => item.UpdatedBy).HasMaxLength(256);

            reviewEvent.HasIndex(item => item.PlanId)
                .HasDatabaseName("IX_EmployeeObjectivePlanReviewEvents_Plan");
            reviewEvent.HasIndex(item => new { item.PlanId, item.OccurredAt })
                .HasDatabaseName("IX_EmployeeObjectivePlanReviewEvents_Plan_OccurredAt");
        });

        builder.Metadata.FindNavigation(nameof(EmployeeObjectivePlan.ReviewEvents))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(plan => new { plan.TenantId, plan.CycleId, plan.EmployeeId })
            .IsUnique()
            .HasDatabaseName("IX_EmployeeObjectivePlans_Tenant_Campaign_Employee");

        builder.HasIndex(plan => new { plan.TenantId, plan.CycleId })
            .HasDatabaseName("IX_EmployeeObjectivePlans_Tenant_Campaign");

        builder.HasIndex(plan => new { plan.TenantId, plan.EmployeeId })
            .HasDatabaseName("IX_EmployeeObjectivePlans_Tenant_Employee");

        builder.Ignore(plan => plan.DomainEvents);
    }
}
