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

        // Map Version property to PostgreSQL xmin system column for optimistic concurrency.
        // xmin is automatically updated by PostgreSQL on every row modification.
        builder.Property(e => e.Version).IsRowVersion();

        builder.Property(e => e.TenantId).IsRequired();
        builder.Property(e => e.EmployeeNumber).HasMaxLength(64);

        builder.Property(e => e.StableEmployeeKey).HasMaxLength(64).IsRequired();

        builder.Property(e => e.FirstName).HasMaxLength(100).IsRequired();
        builder.Property(e => e.LastName).HasMaxLength(100).IsRequired();
        builder.Property(e => e.PreferredName).HasMaxLength(100);

        // Email is normalised (trimmed + lowercased) at the domain boundary.
        // The unique index therefore operates on a consistent value without
        // a DB-level value converter.
        builder.Property(e => e.Email).HasMaxLength(256).IsRequired();
        builder.Property(e => e.Phone).HasMaxLength(50);

        builder.Property(e => e.Department).HasMaxLength(100);
        builder.Property(e => e.JobTitle).HasMaxLength(100);
        builder.Property(e => e.WorkLocation).HasMaxLength(100);
        builder.Property(e => e.EmploymentType).HasMaxLength(50);

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

        // Org-unit relationship.
        // DB FK is SetNull as a defensive fallback (if the constraint fires directly).
        // Org-unit deletion is guarded at the handler level: active assigned employees
        // return Conflict before the DB delete is attempted.
        builder.HasOne(e => e.OrgUnit)
            .WithMany()
            .HasForeignKey(e => e.OrgUnitId)
            .OnDelete(DeleteBehavior.SetNull)
            .IsRequired(false);

        // Tenant-ready indexes (enforcement added in Feature 1.3).
        // The unique composite satisfies US-1.3.2 at the schema level now.
        builder.HasIndex(e => e.TenantId)
            .HasDatabaseName("IX_Employees_TenantId");

        builder.HasIndex(e => new { e.TenantId, e.Email })
            .IsUnique()
            .HasDatabaseName("IX_Employees_TenantId_Email");

        builder.HasIndex(e => new { e.TenantId, e.StableEmployeeKey })
            .IsUnique()
            .HasDatabaseName("IX_Employees_TenantId_StableEmployeeKey");

        builder.HasIndex(e => new { e.TenantId, e.EmployeeNumber })
            .IsUnique()
            .HasFilter("\"EmployeeNumber\" IS NOT NULL")
            .HasDatabaseName("IX_Employees_TenantId_EmployeeNumber");

        builder.HasIndex(e => e.ManagerId)
            .HasDatabaseName("IX_Employees_ManagerId");

        builder.HasIndex(e => e.OrgUnitId)
            .HasDatabaseName("IX_Employees_OrgUnitId");

        // FullName is a computed property — not persisted.
        builder.Ignore(e => e.FullName);
        builder.Ignore(e => e.DisplayName);

        // DomainEvents from AggregateRoot must be explicitly ignored;
        // EF would otherwise attempt to map the public collection.
        builder.Ignore(e => e.DomainEvents);
    }
}
