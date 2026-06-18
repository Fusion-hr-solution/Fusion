using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class ObjectiveTemplateConfiguration : IEntityTypeConfiguration<ObjectiveTemplate>
{
    public void Configure(EntityTypeBuilder<ObjectiveTemplate> builder)
    {
        builder.ToTable("ObjectiveTemplates");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Version).IsRowVersion();

        builder.Property(t => t.TenantId).IsRequired();
        builder.Property(t => t.Name).HasMaxLength(200).IsRequired();
        builder.Property(t => t.Description).HasMaxLength(2000);
        builder.Property(t => t.Category).HasMaxLength(100);
        builder.Property(t => t.DefaultWeight).HasPrecision(5, 2);

        builder.Property(t => t.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired()
            .HasDefaultValue(ObjectiveTemplateStatus.Active);

        builder.Property(t => t.CreatedBy).HasMaxLength(256);
        builder.Property(t => t.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(t => t.TenantId)
            .HasDatabaseName("IX_ObjectiveTemplates_TenantId");

        builder.HasIndex(t => new { t.TenantId, t.Status })
            .HasDatabaseName("IX_ObjectiveTemplates_TenantId_Status");

        builder.HasIndex(t => new { t.TenantId, t.Name })
            .IsUnique()
            .HasDatabaseName("IX_ObjectiveTemplates_TenantId_Name");

        builder.Ignore(t => t.DomainEvents);
    }
}
