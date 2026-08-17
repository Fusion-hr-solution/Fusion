using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public sealed class WorkEmailOccupancyConfiguration : IEntityTypeConfiguration<WorkEmailOccupancy>
{
    public void Configure(EntityTypeBuilder<WorkEmailOccupancy> builder)
    {
        builder.ToTable("WorkEmailOccupancies");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.TenantId).IsRequired();
        builder.Property(x => x.EmployeeId).IsRequired();
        builder.Property(x => x.NormalizedEmail).HasMaxLength(256).IsRequired();
        builder.Property(x => x.CreatedBy).HasMaxLength(256);
        builder.Property(x => x.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(x => new { x.TenantId, x.NormalizedEmail })
            .IsUnique()
            .HasDatabaseName("UX_WorkEmailOccupancies_TenantId_NormalizedEmail");
        builder.HasIndex(x => new { x.TenantId, x.EmployeeId })
            .IsUnique()
            .HasDatabaseName("UX_WorkEmailOccupancies_TenantId_EmployeeId");

        builder.HasOne<Employee>()
            .WithMany()
            .HasForeignKey(x => x.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
