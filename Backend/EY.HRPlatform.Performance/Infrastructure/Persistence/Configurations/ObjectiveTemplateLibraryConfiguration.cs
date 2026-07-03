using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Metadata;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class ObjectiveTemplateLibraryConfiguration : IEntityTypeConfiguration<ObjectiveTemplate>
{
    public void Configure(EntityTypeBuilder<ObjectiveTemplate> builder)
    {
        builder.ToTable("ObjectiveTemplateContainers");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.TenantId).IsRequired();
        builder.Property(t => t.Code).HasMaxLength(20).IsRequired();
        builder.Property(t => t.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired()
            .HasDefaultValue(ObjectiveTemplateStatus.Draft);

        builder.Property(t => t.CreatedAt).IsRequired();
        builder.Property(t => t.UpdatedAt);

        builder.HasMany(t => t.Revisions)
            .WithOne(r => r.Template)
            .HasForeignKey(r => r.TemplateId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(t => t.Revisions)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(t => t.TenantId)
            .HasDatabaseName("IX_ObjectiveTemplateContainers_TenantId");

        builder.HasIndex(t => new { t.TenantId, t.Status })
            .HasDatabaseName("IX_ObjectiveTemplateContainers_TenantId_Status");

        builder.HasIndex(t => new { t.TenantId, t.Code })
            .IsUnique()
            .HasDatabaseName("IX_ObjectiveTemplateContainers_TenantId_Code");

        builder.Ignore(t => t.DomainEvents);
        builder.Ignore(t => t.ActiveRevision);
        builder.Ignore(t => t.DraftRevision);
    }
}
