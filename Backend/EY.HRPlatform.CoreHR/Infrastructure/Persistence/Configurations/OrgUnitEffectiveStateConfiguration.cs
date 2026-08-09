using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public sealed class OrgUnitEffectiveStateConfiguration : IEntityTypeConfiguration<OrgUnitEffectiveState>
{
    public void Configure(EntityTypeBuilder<OrgUnitEffectiveState> builder)
    {
        builder.ToTable("OrgUnitEffectiveStates");
        builder.HasKey(state => state.Id);
        builder.Property(state => state.TenantId).IsRequired();
        builder.Property(state => state.Name).HasMaxLength(200).IsRequired();
        builder.Property(state => state.LifecycleState).IsRequired();
        builder.Property(state => state.EffectiveFrom).IsRequired();
        builder.Property(state => state.EffectiveTo).IsRequired(false);
        builder.Property(state => state.CreatedBy).HasMaxLength(256);
        builder.Property(state => state.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(state => new { state.OrgUnitId, state.EffectiveFrom })
            .IsUnique()
            .HasDatabaseName("UX_OrgUnitEffectiveStates_OrgUnitId_EffectiveFrom");
        builder.HasIndex(state => new { state.TenantId, state.EffectiveFrom })
            .HasDatabaseName("IX_OrgUnitEffectiveStates_TenantId_EffectiveFrom");
        builder.HasIndex(state => new { state.TenantId, state.ParentOrgUnitId })
            .HasDatabaseName("IX_OrgUnitEffectiveStates_TenantId_ParentOrgUnitId");

        builder.HasOne(state => state.OrgUnit)
            .WithMany(unit => unit.EffectiveStates)
            .HasForeignKey(state => state.OrgUnitId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(state => state.OrganizationalUnitType)
            .WithMany()
            .HasForeignKey(state => state.OrganizationalUnitTypeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(state => state.ParentOrgUnit)
            .WithMany()
            .HasForeignKey(state => state.ParentOrgUnitId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
