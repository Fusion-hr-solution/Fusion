using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public sealed class ManagerRelationshipConfiguration : IEntityTypeConfiguration<ManagerRelationship>
{
    public void Configure(EntityTypeBuilder<ManagerRelationship> builder)
    {
        builder.ToTable("ManagerRelationships");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.TenantId).IsRequired();
        builder.Property(x => x.SubjectEmployeeId).IsRequired();
        builder.Property(x => x.ManagerEmployeeId).IsRequired();
        builder.Property(x => x.SubjectWorkAssignmentId).IsRequired();
        builder.Property(x => x.ManagerWorkAssignmentId).IsRequired();

        builder.Property(x => x.Type).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(x => x.EffectiveFrom).IsRequired();
        builder.Property(x => x.EffectiveTo);

        builder.Property(x => x.Source)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();
        builder.Property(x => x.SourceReference).HasMaxLength(256);

        builder.Property(x => x.CreatedBy).HasMaxLength(256);
        builder.Property(x => x.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(x => new { x.TenantId, x.SubjectEmployeeId, x.Type, x.EffectiveFrom })
            .HasDatabaseName("IX_ManagerRelationships_Tenant_Subject_Type_EffectiveFrom");
        builder.HasIndex(x => new { x.TenantId, x.ManagerEmployeeId, x.Type })
            .HasDatabaseName("IX_ManagerRelationships_Tenant_Manager_Type");
        builder.HasIndex(x => new { x.TenantId, x.SubjectWorkAssignmentId })
            .HasDatabaseName("IX_ManagerRelationships_Tenant_SubjectWorkAssignment");

        builder.HasOne<Employee>()
            .WithMany()
            .HasForeignKey(x => x.SubjectEmployeeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Employee>()
            .WithMany()
            .HasForeignKey(x => x.ManagerEmployeeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<WorkAssignment>()
            .WithMany()
            .HasForeignKey(x => x.SubjectWorkAssignmentId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<WorkAssignment>()
            .WithMany()
            .HasForeignKey(x => x.ManagerWorkAssignmentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Ignore(x => x.Interval);
    }
}
