using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public sealed class OrganizationChangeConfiguration : IEntityTypeConfiguration<OrganizationChange>
{
    public void Configure(EntityTypeBuilder<OrganizationChange> builder)
    {
        builder.ToTable("OrganizationChanges");
        builder.HasKey(change => change.Id);
        builder.Property(change => change.TenantId).IsRequired();
        builder.Property(change => change.EffectiveDate).IsRequired();
        builder.Property(change => change.Kind).IsRequired();
        builder.Property(change => change.Reason).HasMaxLength(500);
        builder.Property(change => change.Summary).HasMaxLength(1000);
        builder.Property(change => change.PayloadJson).HasColumnType("jsonb").IsRequired();
        builder.Property(change => change.CreatedBy).HasMaxLength(256);
        builder.Property(change => change.UpdatedBy).HasMaxLength(256);
        builder.HasIndex(change => new { change.TenantId, change.EffectiveDate, change.IsCancelled })
            .HasDatabaseName("IX_OrganizationChanges_TenantId_EffectiveDate_IsCancelled");
        builder.HasIndex(change => new { change.OrgUnitId, change.EffectiveDate })
            .HasDatabaseName("IX_OrganizationChanges_OrgUnitId_EffectiveDate");
        builder.HasOne(change => change.OrgUnit)
            .WithMany(unit => unit.OrganizationChanges)
            .HasForeignKey(change => change.OrgUnitId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
