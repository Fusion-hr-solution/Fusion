using EY.HRPlatform.Performance.Domain.Development;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class DevelopmentPlanConfiguration : IEntityTypeConfiguration<DevelopmentPlan>
{
    public void Configure(EntityTypeBuilder<DevelopmentPlan> builder)
    {
        builder.ToTable("DevelopmentPlans");
        builder.HasKey(plan => plan.Id);
        builder.Property(plan => plan.Version).IsRowVersion();

        builder.HasIndex(plan => plan.TenantId);
        builder.HasIndex(plan => new { plan.TenantId, plan.EmployeeId });
        // One development plan per participant per Cycle (D-34).
        builder.HasIndex(plan => new { plan.TenantId, plan.CycleId, plan.ParticipantId }).IsUnique();

        builder.HasMany(plan => plan.Goals)
            .WithOne()
            .HasForeignKey(goal => goal.DevelopmentPlanId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(plan => plan.Goals).AutoInclude();
    }
}

public sealed class DevelopmentGoalConfiguration : IEntityTypeConfiguration<DevelopmentGoal>
{
    public void Configure(EntityTypeBuilder<DevelopmentGoal> builder)
    {
        builder.ToTable("DevelopmentGoals");
        builder.HasKey(goal => goal.Id);
        builder.Property(goal => goal.Title).IsRequired().HasMaxLength(DevelopmentGoal.MaxTitleLength);
        builder.Property(goal => goal.ActionsJson).IsRequired().HasColumnType("jsonb");
        builder.Property(goal => goal.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasIndex(goal => goal.DevelopmentPlanId);
    }
}
