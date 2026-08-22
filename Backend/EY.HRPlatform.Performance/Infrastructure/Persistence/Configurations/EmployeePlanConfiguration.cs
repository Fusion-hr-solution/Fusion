using EY.HRPlatform.Performance.Domain.Plans;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class EmployeePlanConfiguration : IEntityTypeConfiguration<EmployeePlan>
{
    public void Configure(EntityTypeBuilder<EmployeePlan> builder)
    {
        builder.ToTable("EmployeePlans");
        builder.HasKey(plan => plan.Id);

        builder.Property(plan => plan.EmployeeDisplayName).IsRequired().HasMaxLength(300);
        builder.Property(plan => plan.OrgUnitName).HasMaxLength(300);
        builder.Property(plan => plan.ResponsibleManagerName).HasMaxLength(300);
        builder.Property(plan => plan.State).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(plan => plan.ApprovalKind).HasConversion<string>().HasMaxLength(20);

        builder.HasIndex(plan => plan.TenantId);
        builder.HasIndex(plan => plan.CycleId);
        builder.HasIndex(plan => plan.ResponsibleManagerId);

        // A participant holds at most one plan per Cycle, and an employee at most one — protected by
        // unique constraints, not application timing (product-spec §16).
        builder.HasIndex(plan => new { plan.TenantId, plan.CycleId, plan.ParticipantId }).IsUnique();
        builder.HasIndex(plan => new { plan.TenantId, plan.CycleId, plan.EmployeeId }).IsUnique();

        builder.HasMany(plan => plan.Decisions)
            .WithOne()
            .HasForeignKey(decision => decision.PlanId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(plan => plan.Decisions).AutoInclude(false);
    }
}

public sealed class PlanDecisionConfiguration : IEntityTypeConfiguration<PlanDecision>
{
    public void Configure(EntityTypeBuilder<PlanDecision> builder)
    {
        builder.ToTable("PlanDecisions");
        builder.HasKey(decision => decision.Id);
        builder.Property(decision => decision.Kind).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(decision => decision.Feedback).HasMaxLength(2000);
        builder.HasIndex(decision => decision.PlanId);
    }
}
