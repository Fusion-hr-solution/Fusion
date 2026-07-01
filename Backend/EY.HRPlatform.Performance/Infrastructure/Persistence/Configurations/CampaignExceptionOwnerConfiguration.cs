using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class CampaignExceptionOwnerConfiguration : IEntityTypeConfiguration<CampaignExceptionOwner>
{
    public void Configure(EntityTypeBuilder<CampaignExceptionOwner> builder)
    {
        builder.ToTable("CampaignExceptionOwners");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.TenantId).IsRequired();
        builder.Property(x => x.CycleId).IsRequired();
        builder.Property(x => x.EmployeeId).IsRequired();
        builder.Property(x => x.Priority).IsRequired();
        builder.HasIndex(x => new { x.CycleId, x.EmployeeId }).IsUnique();
        builder.HasIndex(x => new { x.CycleId, x.Priority }).IsUnique();
        builder.HasIndex(x => x.TenantId);
    }
}
