using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class CampaignWorkItemConfiguration : IEntityTypeConfiguration<CampaignWorkItem>
{
    public void Configure(EntityTypeBuilder<CampaignWorkItem> builder)
    {
        builder.ToTable("CampaignWorkItems");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Version).IsRowVersion();
        builder.Property(item => item.Type).HasConversion<string>().HasMaxLength(40).IsRequired();
        builder.Property(item => item.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasIndex(item => new { item.TenantId, item.AssigneeEmployeeId, item.Status, item.DueAt });
        builder.HasIndex(item => new { item.CycleId, item.SubjectEmployeeId, item.Type });
        builder.HasIndex(item => item.SourceAssignmentRevisionId).IsUnique();
        builder.Ignore(item => item.DomainEvents);
    }
}
