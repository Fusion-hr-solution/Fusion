using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public class DraftOrgUnitConfiguration : IEntityTypeConfiguration<DraftOrgUnit>
{
    public void Configure(EntityTypeBuilder<DraftOrgUnit> builder)
    {
        builder.ToTable("DraftOrgUnits");
        builder.HasKey(o => o.Id);

        builder.Property(o => o.Version).IsRowVersion();

        builder.Property(o => o.TenantId).IsRequired();

        builder.Property(o => o.ReferenceKey)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(o => o.NormalizedReferenceKey)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(o => o.DisplayName)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(o => o.OrgUnitKindKey)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(o => o.Location)
            .HasMaxLength(100)
            .IsRequired(false);

        builder.Property(o => o.Description)
            .HasMaxLength(500)
            .IsRequired(false);

        builder.Property(o => o.AttributesJson)
            .HasColumnType("jsonb")
            .IsRequired(false);

        builder.Property(o => o.CreatedBy).HasMaxLength(256);
        builder.Property(o => o.UpdatedBy).HasMaxLength(256);

        builder.HasOne(o => o.Parent)
            .WithMany()
            .HasForeignKey(o => o.ParentId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);

        builder.HasIndex(o => o.TenantId)
            .HasDatabaseName("IX_DraftOrgUnits_TenantId");

        builder.HasIndex(o => new { o.TenantId, o.NormalizedReferenceKey })
            .IsUnique()
            .HasDatabaseName("IX_DraftOrgUnits_TenantId_NormalizedReferenceKey");

        builder.HasIndex(o => o.ParentId)
            .HasDatabaseName("IX_DraftOrgUnits_ParentId");
    }
}