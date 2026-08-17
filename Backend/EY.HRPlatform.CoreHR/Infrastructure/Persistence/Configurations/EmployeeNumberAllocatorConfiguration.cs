using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public sealed class EmployeeNumberAllocatorConfiguration : IEntityTypeConfiguration<EmployeeNumberAllocator>
{
    public void Configure(EntityTypeBuilder<EmployeeNumberAllocator> builder)
    {
        builder.ToTable("EmployeeNumberAllocators");
        builder.HasKey(x => x.TenantId);
        builder.Property(x => x.TenantId).ValueGeneratedNever();
        builder.Property(x => x.NextValue).IsRequired();
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_EmployeeNumberAllocators_NextValue_Positive", "\"NextValue\" > 0"));
    }
}
