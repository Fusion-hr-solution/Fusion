using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class PerformanceCycleConfiguration : IEntityTypeConfiguration<PerformanceCycle>
{
    public void Configure(EntityTypeBuilder<PerformanceCycle> builder)
    {
        builder.ToTable("PerformanceCycles");
        builder.HasKey(c => c.Id);

        // Map Version to PostgreSQL xmin for optimistic concurrency.
        builder.Property(c => c.Version).IsRowVersion();

        builder.Property(c => c.TenantId).IsRequired();
        builder.Property(c => c.Name).HasMaxLength(200).IsRequired();
        builder.Property(c => c.Slug).HasMaxLength(240).IsRequired();
        builder.Property(c => c.Description).HasMaxLength(2000);
        builder.Property(c => c.Purpose).HasMaxLength(2000);
        builder.Property(c => c.ReferenceYear);
        builder.Property(c => c.OwnerUserId);
        builder.Property(c => c.OwnerName).HasMaxLength(256);

        builder.Property(c => c.Type)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(c => c.PeriodStart).IsRequired();
        builder.Property(c => c.PeriodEnd).IsRequired();
        builder.Property(c => c.PlanningOpeningDate);
        builder.Property(c => c.EmployeeSubmissionDeadline);
        builder.Property(c => c.ManagerApprovalDeadline);
        builder.Property(c => c.ExpectedPlanningLockDate);
        builder.Property(c => c.PlanningLockedAt);
        builder.Property(c => c.PlanningLockedByUserId);
        builder.Property(c => c.PlanningLockedByName).HasMaxLength(256);

        builder.OwnsOne(c => c.PlanningRulesSnapshot, snapshot =>
        {
            snapshot.Property(s => s.MaxObjectiveCount)
                .HasColumnName("PlanningRulesMaxObjectiveCount");
            snapshot.Property(s => s.AllowedWeightMenu)
                .HasColumnName("PlanningRulesAllowedWeightMenu")
                .HasMaxLength(500);
            snapshot.Property(s => s.EnabledMeasurementMethods)
                .HasColumnName("PlanningRulesEnabledMeasurementMethods")
                .HasMaxLength(100);
            snapshot.Property(s => s.SourceConfigurationVersionId)
                .HasColumnName("PlanningRulesSourceConfigurationVersionId");
            snapshot.Property(s => s.CapturedAt)
                .HasColumnName("PlanningRulesCapturedAt");
        });

        builder.Property(c => c.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired()
            .HasDefaultValue(PerformanceCycleStatus.Draft);

        builder.Property(c => c.CreatedBy).HasMaxLength(256);
        builder.Property(c => c.UpdatedBy).HasMaxLength(256);

        builder.HasMany(c => c.PopulationRules)
            .WithOne()
            .HasForeignKey(r => r.CycleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(c => c.Participants)
            .WithOne()
            .HasForeignKey(p => p.CycleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(c => c.ApproverOverrides)
            .WithOne()
            .HasForeignKey(x => x.CycleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(c => c.StrategicObjectives)
            .WithOne()
            .HasForeignKey(x => x.CycleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Metadata.FindNavigation(nameof(PerformanceCycle.PopulationRules))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(PerformanceCycle.Participants))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(PerformanceCycle.ApproverOverrides))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(PerformanceCycle.StrategicObjectives))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(c => c.TenantId)
            .HasDatabaseName("IX_PerformanceCycles_TenantId");

        builder.HasIndex(c => new { c.TenantId, c.Name })
            .IsUnique()
            .HasDatabaseName("IX_PerformanceCycles_TenantId_Name");

        builder.HasIndex(c => new { c.TenantId, c.Slug })
            .IsUnique()
            .HasDatabaseName("IX_PerformanceCycles_TenantId_Slug");

        builder.HasIndex(c => new { c.TenantId, c.Status })
            .HasDatabaseName("IX_PerformanceCycles_TenantId_Status");

        builder.HasIndex(c => new { c.TenantId, c.ReferenceYear })
            .HasDatabaseName("IX_PerformanceCycles_TenantId_ReferenceYear");

        builder.Ignore(c => c.IsEditable);
        builder.Ignore(c => c.IsPlanningLocked);
        builder.Ignore(c => c.DomainEvents);
    }
}
