using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public class TenantSetupActivityConfiguration : IEntityTypeConfiguration<TenantSetupActivity>
{
    public void Configure(EntityTypeBuilder<TenantSetupActivity> builder)
    {
        builder.ToTable("TenantSetupActivities");
        builder.HasKey(activity => activity.Id);

        builder.Property(activity => activity.TenantId).IsRequired();
        builder.Property(activity => activity.TenantSetupStateId).IsRequired();

        builder.Property(activity => activity.ActivityType)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(activity => activity.ActorFullName)
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(activity => activity.ActorRole)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(activity => activity.CreatedBy).HasMaxLength(256);
        builder.Property(activity => activity.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(activity => activity.TenantId)
            .HasDatabaseName("IX_TenantSetupActivities_TenantId");

        builder.HasIndex(activity => new { activity.TenantSetupStateId, activity.CreatedAt })
            .HasDatabaseName("IX_TenantSetupActivities_StateId_CreatedAt");
    }
}
