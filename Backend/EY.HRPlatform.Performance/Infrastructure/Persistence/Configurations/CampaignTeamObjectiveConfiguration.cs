using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class CampaignTeamObjectiveConfiguration : IEntityTypeConfiguration<CampaignTeamObjective>
{
    public void Configure(EntityTypeBuilder<CampaignTeamObjective> builder)
    {
        builder.ToTable("CampaignTeamObjectives");
        builder.HasKey(objective => objective.Id);

        builder.Property(objective => objective.Version).IsRowVersion();

        builder.Property(objective => objective.TenantId).IsRequired();
        builder.Property(objective => objective.CycleId).IsRequired();
        builder.Property(objective => objective.StrategicObjectiveId).IsRequired();
        builder.Property(objective => objective.OwnerManagerEmployeeId).IsRequired();
        builder.Property(objective => objective.OwnerManagerName)
            .HasMaxLength(CampaignTeamObjective.OwnerManagerNameMaxLength)
            .IsRequired();
        builder.Property(objective => objective.Title)
            .HasMaxLength(CampaignTeamObjective.TitleMaxLength)
            .IsRequired();
        builder.Property(objective => objective.SuccessCriteria)
            .HasMaxLength(CampaignTeamObjective.SuccessCriteriaMaxLength)
            .IsRequired();
        builder.Property(objective => objective.MeasurementMethod)
            .HasMaxLength(CampaignTeamObjective.MeasurementMethodMaxLength)
            .IsRequired();
        builder.Property(objective => objective.Description)
            .HasMaxLength(CampaignTeamObjective.DescriptionMaxLength);
        builder.Property(objective => objective.CreatedBy).HasMaxLength(256);
        builder.Property(objective => objective.UpdatedBy).HasMaxLength(256);

        builder.Ignore(objective => objective.DomainEvents);

        builder.HasOne<PerformanceCycle>()
            .WithMany()
            .HasForeignKey(objective => objective.CycleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<CampaignStrategicObjective>()
            .WithMany()
            .HasForeignKey(objective => objective.StrategicObjectiveId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(objective => new { objective.TenantId, objective.CycleId })
            .HasDatabaseName("IX_CampaignTeamObjectives_Tenant_Campaign");

        builder.HasIndex(objective => new { objective.TenantId, objective.CycleId, objective.OwnerManagerEmployeeId })
            .HasDatabaseName("IX_CampaignTeamObjectives_Tenant_Campaign_Owner");

        builder.HasIndex(objective => new { objective.TenantId, objective.StrategicObjectiveId })
            .HasDatabaseName("IX_CampaignTeamObjectives_Tenant_StrategicObjective");
    }
}
