using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class ObjectiveTemplateCategoryConfiguration : IEntityTypeConfiguration<ObjectiveTemplateCategory>
{
    public void Configure(EntityTypeBuilder<ObjectiveTemplateCategory> builder)
    {
        builder.ToTable("ObjectiveTemplateCategories");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.TenantId).IsRequired();
        builder.Property(c => c.Code).HasMaxLength(50).IsRequired();
        builder.Property(c => c.Name).HasMaxLength(100).IsRequired();
        builder.Property(c => c.NormalizedName).HasMaxLength(100).IsRequired();
        builder.Property(c => c.Description).HasMaxLength(500);
        builder.Property(c => c.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();
        builder.Property(c => c.CreatedBy).HasMaxLength(256);
        builder.Property(c => c.UpdatedBy).HasMaxLength(256);

        // Code uniqueness per tenant
        builder.HasIndex(c => new { c.TenantId, c.Code })
            .IsUnique()
            .HasDatabaseName("IX_ObjectiveTemplateCategories_TenantId_Code");

        // Normalized name uniqueness per tenant
        builder.HasIndex(c => new { c.TenantId, c.NormalizedName })
            .IsUnique()
            .HasDatabaseName("IX_ObjectiveTemplateCategories_TenantId_NormalizedName");

        builder.HasIndex(c => c.TenantId)
            .HasDatabaseName("IX_ObjectiveTemplateCategories_TenantId");
    }
}
