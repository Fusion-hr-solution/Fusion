using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class TenantObjectivePolicyVersionConfiguration : IEntityTypeConfiguration<TenantObjectivePolicyVersion>
{
    public void Configure(EntityTypeBuilder<TenantObjectivePolicyVersion> builder)
    {
        builder.ToTable("TenantObjectivePolicyVersions");
        builder.HasKey(v => v.Id);

        builder.Property(v => v.TenantId).IsRequired();
        builder.Property(v => v.PolicyId).IsRequired();
        builder.Property(v => v.VersionNumber).IsRequired();
        builder.Property(v => v.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(v => v.MaxObjectivesPerPlan).IsRequired();
        builder.Property(v => v.AllowedWeightValues).HasMaxLength(500).IsRequired();
        builder.Property(v => v.MeasurementTypes).HasMaxLength(50).IsRequired();

        // Map Version to PostgreSQL xmin for optimistic concurrency.
        builder.Property(v => v.Version).IsRowVersion();

        builder.Property(v => v.SourceVersionId);
        builder.Property(v => v.SourceStartingConfigurationVersionId)
            .HasColumnName("SourceBaselineVersionId");

        builder.Property(v => v.CreatedByUserId).IsRequired();
        builder.Property(v => v.CreatedByName).HasMaxLength(256);
        builder.Property(v => v.AppliedAt)
            .HasColumnName("ActivatedAt");
        builder.Property(v => v.AppliedByUserId)
            .HasColumnName("ActivatedByUserId");
        builder.Property(v => v.AppliedByName)
            .HasColumnName("ActivatedByName")
            .HasMaxLength(256);
        builder.Property(v => v.ChangeSummary).HasMaxLength(500);
        builder.Property(v => v.ReplacedAt)
            .HasColumnName("SupersededAt");
        builder.Property(v => v.CreatedBy).HasMaxLength(256);
        builder.Property(v => v.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(v => v.PolicyId)
            .HasDatabaseName("IX_TenantObjectivePolicyVersions_PolicyId");

        builder.HasIndex(v => new { v.PolicyId, v.Status })
            .HasDatabaseName("IX_TenantObjectivePolicyVersions_Policy_Status");

        builder.HasIndex(v => v.TenantId)
            .HasDatabaseName("IX_TenantObjectivePolicyVersions_TenantId");
    }
}
