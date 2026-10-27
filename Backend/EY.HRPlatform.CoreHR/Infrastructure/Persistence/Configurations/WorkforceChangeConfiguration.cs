using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public sealed class WorkforceChangeConfiguration : IEntityTypeConfiguration<WorkforceChange>
{
    public void Configure(EntityTypeBuilder<WorkforceChange> builder)
    {
        builder.ToTable("WorkforceChanges");
        builder.HasKey(change => change.Id);
        builder.Property(change => change.TenantId).IsRequired();
        builder.Property(change => change.EmployeeId).IsRequired();
        builder.Property(change => change.Kind).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(change => change.EffectiveDate).IsRequired();
        builder.Property(change => change.Note).HasMaxLength(1000);
        builder.Property(change => change.PayloadJson).HasColumnType("jsonb").IsRequired();
        builder.Property(change => change.CancelledBy).HasMaxLength(256);
        builder.Property(change => change.CreatedBy).HasMaxLength(256);
        builder.Property(change => change.UpdatedBy).HasMaxLength(256);
        builder.HasIndex(change => new { change.TenantId, change.EffectiveDate, change.IsCancelled })
            .HasDatabaseName("IX_WorkforceChanges_TenantId_EffectiveDate_IsCancelled");
        builder.HasIndex(change => new { change.EmployeeId, change.EffectiveDate })
            .HasDatabaseName("IX_WorkforceChanges_EmployeeId_EffectiveDate");
        builder.HasOne<Employee>()
            .WithMany()
            .HasForeignKey(change => change.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(change => change.Effects)
            .WithOne()
            .HasForeignKey(effect => effect.ChangeId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(change => change.Effects).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

public sealed class WorkforceChangeEffectConfiguration : IEntityTypeConfiguration<WorkforceChangeEffect>
{
    public void Configure(EntityTypeBuilder<WorkforceChangeEffect> builder)
    {
        builder.ToTable("WorkforceChangeEffects");
        builder.HasKey(effect => effect.Id);
        builder.Property(effect => effect.TenantId).IsRequired();
        builder.Property(effect => effect.EntityType).HasMaxLength(40).IsRequired();
        builder.Property(effect => effect.Action).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(effect => effect.CreatedBy).HasMaxLength(256);
        builder.Property(effect => effect.UpdatedBy).HasMaxLength(256);
        builder.HasIndex(effect => effect.ChangeId).HasDatabaseName("IX_WorkforceChangeEffects_ChangeId");
        builder.HasIndex(effect => new { effect.EntityType, effect.EntityId })
            .HasDatabaseName("IX_WorkforceChangeEffects_EntityType_EntityId");
    }
}
