using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class CampaignAssignmentResponsibilityConfiguration : IEntityTypeConfiguration<CampaignAssignmentResponsibility>
{
    public void Configure(EntityTypeBuilder<CampaignAssignmentResponsibility> builder)
    {
        builder.ToTable("CampaignAssignmentResponsibilities");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.TenantId).IsRequired();
        builder.Property(x => x.CycleId).IsRequired();
        builder.Property(x => x.SubjectEmployeeId).IsRequired();
        builder.Property(x => x.AssigneeEmployeeId).IsRequired();
        builder.Property(x => x.AssigneeName).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Duty).HasConversion<string>().HasMaxLength(40).IsRequired();
        builder.Property(x => x.Source).HasConversion<string>().HasMaxLength(40).IsRequired();
        builder.Property(x => x.RelationshipSource).HasMaxLength(80).IsRequired();
        builder.Property(x => x.OverrideReason).HasMaxLength(1000);
        builder.Property(x => x.Revision).IsRequired();
        builder.Property(x => x.RecordedAt).IsRequired();
        builder.HasIndex(x => new { x.CycleId, x.SubjectEmployeeId, x.Duty, x.Revision }).IsUnique();
        builder.HasIndex(x => new { x.CycleId, x.AssigneeEmployeeId, x.IsFinal });
        builder.HasIndex(x => x.TenantId);
    }
}
