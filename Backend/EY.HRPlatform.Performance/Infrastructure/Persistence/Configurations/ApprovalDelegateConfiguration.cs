using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class ApprovalDelegateConfiguration : IEntityTypeConfiguration<ApprovalDelegate>
{
    public void Configure(EntityTypeBuilder<ApprovalDelegate> builder)
    {
        builder.ToTable("ApprovalDelegates");
        builder.HasKey(d => d.Id);
        builder.Property(d => d.TenantId).IsRequired();
        builder.Property(d => d.CycleId).IsRequired();
        builder.Property(d => d.DelegatorEmployeeId).IsRequired();
        builder.Property(d => d.DelegateEmployeeId).IsRequired();
        builder.Property(d => d.ValidFrom).IsRequired();
        builder.Property(d => d.CreatedBy).HasMaxLength(256);
        builder.Property(d => d.UpdatedBy).HasMaxLength(256);
        builder.HasIndex(d => new { d.TenantId, d.CycleId, d.DelegatorEmployeeId })
            .HasDatabaseName("IX_ApprovalDelegates_Tenant_Cycle_Delegator");
        builder.HasIndex(d => new { d.TenantId, d.CycleId, d.IsActive })
            .HasDatabaseName("IX_ApprovalDelegates_Tenant_Cycle_Active");
    }
}
