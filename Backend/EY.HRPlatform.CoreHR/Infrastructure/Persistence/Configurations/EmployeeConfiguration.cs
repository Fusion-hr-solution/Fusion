using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public class EmployeeConfiguration : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> builder)
    {
        builder.ToTable("Employees");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.TenantId).IsRequired();

        builder.Property(e => e.FirstName).HasMaxLength(100).IsRequired();
        builder.Property(e => e.LastName).HasMaxLength(100).IsRequired();

        // Email is normalised (trimmed + lowercased) at the domain boundary.
        // The unique index therefore operates on a consistent value without
        // a DB-level value converter.
        builder.Property(e => e.Email).HasMaxLength(256).IsRequired();

        builder.Property(e => e.Department).HasMaxLength(100);
        builder.Property(e => e.JobTitle).HasMaxLength(100);

        // HireDate stored as UTC timestamp. The global UtcDateTimeConverter
        // convention in CoreHRDbContext.ConfigureConventions handles read-side
        // normalisation; callers are responsible for passing UTC values.
        builder.Property(e => e.HireDate).IsRequired();

        builder.Property(e => e.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired()
            .HasDefaultValue(EmployeeStatus.Active);

        // Audit fields inherited from BaseEntity
        builder.Property(e => e.CreatedBy).HasMaxLength(256);
        builder.Property(e => e.UpdatedBy).HasMaxLength(256);

        // Self-referencing manager relationship.
        // SetNull: removing a manager nulls ManagerId on direct reports
        // rather than cascading a delete or blocking deletion.
        builder.HasOne(e => e.Manager)
            .WithMany()
            .HasForeignKey(e => e.ManagerId)
            .OnDelete(DeleteBehavior.SetNull)
            .IsRequired(false);

        // Tenant-ready indexes (enforcement added in Feature 1.3).
        // The unique composite satisfies US-1.3.2 at the schema level now.
        builder.HasIndex(e => e.TenantId)
            .HasDatabaseName("IX_Employees_TenantId");

        builder.HasIndex(e => new { e.TenantId, e.Email })
            .IsUnique()
            .HasDatabaseName("IX_Employees_TenantId_Email");

        builder.HasIndex(e => e.ManagerId)
            .HasDatabaseName("IX_Employees_ManagerId");

        // FullName is a computed property — not persisted.
        builder.Ignore(e => e.FullName);

        // DomainEvents from AggregateRoot must be explicitly ignored;
        // EF would otherwise attempt to map the public collection.
        builder.Ignore(e => e.DomainEvents);
    }
}
