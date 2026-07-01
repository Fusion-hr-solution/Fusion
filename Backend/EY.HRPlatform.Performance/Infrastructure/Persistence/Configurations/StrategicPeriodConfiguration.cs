using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class StrategicPeriodConfiguration : IEntityTypeConfiguration<StrategicPeriod>
{
    public void Configure(EntityTypeBuilder<StrategicPeriod> builder)
    {
        builder.ToTable("StrategicPeriods");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Version).IsRowVersion();
        builder.Property(p => p.Label).HasMaxLength(100).IsRequired();
        builder.Property(p => p.Granularity).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(p => p.StartDate).IsRequired();
        builder.Property(p => p.EndDate).IsRequired();
        builder.HasIndex(p => new { p.TenantId, p.FiscalYear, p.Granularity })
            .HasDatabaseName("IX_StrategicPeriods_Tenant_FiscalYear_Granularity");
        builder.Property(p => p.CreatedBy).HasMaxLength(256);
        builder.Property(p => p.UpdatedBy).HasMaxLength(256);
        builder.Ignore(p => p.DomainEvents);
    }
}
