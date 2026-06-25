using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class StrategicObjectiveConfiguration : IEntityTypeConfiguration<StrategicObjective>
{
    public void Configure(EntityTypeBuilder<StrategicObjective> builder)
    {
        builder.ToTable("StrategicObjectives");
        builder.HasKey(o => o.Id);
        builder.Property(o => o.Version).IsRowVersion();
        builder.Property(o => o.Title).HasMaxLength(200).IsRequired();
        builder.Property(o => o.Description).HasMaxLength(2000);
        builder.Property(o => o.OrgScope).HasMaxLength(100).IsRequired();
        builder.Property(o => o.Status).HasConversion<string>().HasMaxLength(20).IsRequired();

        // Composite index for fast status lookups by tenant+period+scope (D-03)
        builder.HasIndex(o => new { o.TenantId, o.PeriodId, o.OrgScope, o.Status })
            .HasDatabaseName("IX_StrategicObjectives_Tenant_Period_Scope_Status");

        // The filtered unique index for "exactly one Published per tenant+scope+period" (D-03)
        // is added in the migration via migrationBuilder.Sql() because EF's HasFilter on a
        // partial index requires raw SQL for the WHERE clause.

        builder.Property(o => o.CreatedBy).HasMaxLength(256);
        builder.Property(o => o.UpdatedBy).HasMaxLength(256);
        builder.Ignore(o => o.DomainEvents);
    }
}
