using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public class OrgUnitConfiguration : IEntityTypeConfiguration<OrgUnit>
{
    public void Configure(EntityTypeBuilder<OrgUnit> builder)
    {
        builder.ToTable("OrgUnits");
        builder.HasKey(o => o.Id);

        // Map Version property to PostgreSQL xmin system column for optimistic concurrency.
        builder.Property(o => o.Version).IsRowVersion();

        builder.Property(o => o.TenantId).IsRequired();

        // Code is normalized to uppercase at the domain boundary.
        builder.Property(o => o.Code)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(o => o.Name)
            .HasMaxLength(200)
            .IsRequired();

        // Type must match tenant's configured orgUnitTypes (validated in handler).
        builder.Property(o => o.Type)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(o => o.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        // Audit fields inherited from BaseEntity
        builder.Property(o => o.CreatedBy).HasMaxLength(256);
        builder.Property(o => o.UpdatedBy).HasMaxLength(256);

        // Responsible manager is stored as an id-only reference (no FK constraint).
        builder.Property(o => o.ResponsibleManagerEmployeeId)
            .IsRequired(false);

        // Self-referencing parent relationship.
        // Restrict: cannot delete an org unit that has children.
        builder.HasOne(o => o.Parent)
            .WithMany()
            .HasForeignKey(o => o.ParentId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);

        // Tenant-scoped indexes
        builder.HasIndex(o => o.TenantId)
            .HasDatabaseName("IX_OrgUnits_TenantId");

        // Code must be unique within tenant
        builder.HasIndex(o => new { o.TenantId, o.Code })
            .IsUnique()
            .HasDatabaseName("IX_OrgUnits_TenantId_Code");

        // Name must be unique within tenant
        builder.HasIndex(o => new { o.TenantId, o.Name })
            .IsUnique()
            .HasDatabaseName("IX_OrgUnits_TenantId_Name");

        // Index for hierarchy queries
        builder.HasIndex(o => o.ParentId)
            .HasDatabaseName("IX_OrgUnits_ParentId");

        // DomainEvents from AggregateRoot must be explicitly ignored
        builder.Ignore(o => o.DomainEvents);
    }
}
