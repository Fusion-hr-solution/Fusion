using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public class EmployeeReportingRelationshipConfiguration : IEntityTypeConfiguration<EmployeeReportingRelationship>
{
    public void Configure(EntityTypeBuilder<EmployeeReportingRelationship> builder)
    {
        builder.ToTable("EmployeeReportingRelationships");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.TenantId).IsRequired();
        builder.Property(x => x.SubjectEmployeeId).IsRequired();
        builder.Property(x => x.ManagerEmployeeId).IsRequired();
        builder.Property(x => x.SubjectPositionAssignmentId).IsRequired();
        builder.Property(x => x.ManagerPositionAssignmentId).IsRequired();
        builder.Property(x => x.Type).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(x => x.EffectiveFrom).IsRequired();
        builder.Property(x => x.EffectiveTo);
        builder.Property(x => x.CreatedBy).HasMaxLength(256);
        builder.Property(x => x.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(x => new { x.TenantId, x.SubjectEmployeeId, x.Type, x.EffectiveFrom })
            .HasDatabaseName("IX_EmployeeReportingRelationships_Tenant_Subject_Type_EffectiveFrom");
        builder.HasIndex(x => new { x.TenantId, x.ManagerEmployeeId, x.Type })
            .HasDatabaseName("IX_EmployeeReportingRelationships_Tenant_Manager_Type");

        builder.HasOne<Employee>()
            .WithMany()
            .HasForeignKey(x => x.SubjectEmployeeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Employee>()
            .WithMany()
            .HasForeignKey(x => x.ManagerEmployeeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<EmployeePositionAssignment>()
            .WithMany()
            .HasForeignKey(x => x.SubjectPositionAssignmentId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<EmployeePositionAssignment>()
            .WithMany()
            .HasForeignKey(x => x.ManagerPositionAssignmentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
