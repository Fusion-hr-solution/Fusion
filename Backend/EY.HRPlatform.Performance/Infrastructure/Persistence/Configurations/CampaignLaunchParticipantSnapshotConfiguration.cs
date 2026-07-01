using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class CampaignLaunchParticipantSnapshotConfiguration : IEntityTypeConfiguration<CampaignLaunchParticipantSnapshot>
{
    public void Configure(EntityTypeBuilder<CampaignLaunchParticipantSnapshot> builder)
    {
        builder.ToTable("CampaignLaunchParticipantSnapshots");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.TenantId).IsRequired();
        builder.Property(x => x.CycleId).IsRequired();
        builder.Property(x => x.EmployeeId).IsRequired();
        builder.Property(x => x.FullName).IsRequired().HasMaxLength(256);
        builder.Property(x => x.EmployeeKey).HasMaxLength(100);
        builder.Property(x => x.Email).HasMaxLength(320);
        builder.Property(x => x.OrgUnitName).HasMaxLength(256);
        builder.Property(x => x.JobTitle).HasMaxLength(256);
        builder.Property(x => x.PrimaryManagerName).HasMaxLength(256);
        builder.Property(x => x.FrozenAt).IsRequired();
        builder.HasIndex(x => new { x.CycleId, x.EmployeeId }).IsUnique();
        builder.HasIndex(x => x.TenantId);
    }
}
