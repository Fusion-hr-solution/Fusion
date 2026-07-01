using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public sealed class EmployeeOrgMembershipConfiguration : IEntityTypeConfiguration<EmployeeOrgMembership>
{
    public void Configure(EntityTypeBuilder<EmployeeOrgMembership> builder)
    {
        builder.ToTable("EmployeeOrgMemberships");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Type).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.HasIndex(x => new { x.TenantId, x.EmployeeId, x.IsPrimary, x.EffectiveFrom });
        builder.HasIndex(x => new { x.TenantId, x.OrgUnitId });
    }
}
