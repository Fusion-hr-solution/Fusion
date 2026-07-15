using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public sealed class EmployeePositionAssignmentConfiguration : IEntityTypeConfiguration<EmployeePositionAssignment>
{
    public void Configure(EntityTypeBuilder<EmployeePositionAssignment> builder)
    {
        builder.ToTable("EmployeePositionAssignments");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.PositionId);
        builder.Property(x => x.LegacyPositionTitle).HasColumnName("PositionTitle").HasMaxLength(150);
        builder.HasIndex(x => new { x.TenantId, x.EmployeeId, x.IsPrimary, x.EffectiveFrom });
        builder.HasIndex(x => new { x.TenantId, x.PositionId });
        builder.HasIndex(x => x.TenantId);
        builder.HasOne<Position>()
            .WithMany()
            .HasForeignKey(x => x.PositionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
