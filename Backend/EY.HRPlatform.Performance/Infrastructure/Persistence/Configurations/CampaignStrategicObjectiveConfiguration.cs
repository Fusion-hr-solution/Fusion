using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class CampaignStrategicObjectiveConfiguration : IEntityTypeConfiguration<CampaignStrategicObjective>
{
    public void Configure(EntityTypeBuilder<CampaignStrategicObjective> builder)
    {
        builder.ToTable("CampaignStrategicObjectives");
        builder.HasKey(objective => objective.Id);

        builder.Property(objective => objective.Version).IsRowVersion();

        builder.Property(objective => objective.TenantId).IsRequired();
        builder.Property(objective => objective.CycleId).IsRequired();
        builder.Property(objective => objective.Title)
            .HasMaxLength(CampaignStrategicObjective.TitleMaxLength)
            .IsRequired();
        builder.Property(objective => objective.Description)
            .HasMaxLength(CampaignStrategicObjective.DescriptionMaxLength);
        builder.Property(objective => objective.ResponsibleFunctionLabel)
            .HasMaxLength(CampaignStrategicObjective.ResponsibleFunctionMaxLength);
        builder.Property(objective => objective.IsActive).IsRequired();
        builder.Property(objective => objective.CreatedBy).HasMaxLength(256);
        builder.Property(objective => objective.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(objective => new { objective.TenantId, objective.CycleId })
            .HasDatabaseName("IX_CampaignStrategicObjectives_Tenant_Campaign");
    }
}
