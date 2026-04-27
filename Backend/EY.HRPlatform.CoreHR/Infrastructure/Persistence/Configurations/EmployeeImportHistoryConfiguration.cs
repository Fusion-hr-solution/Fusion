using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public class EmployeeImportHistoryConfiguration : IEntityTypeConfiguration<EmployeeImportHistory>
{
    public void Configure(EntityTypeBuilder<EmployeeImportHistory> builder)
    {
        builder.ToTable("EmployeeImportHistories");
        builder.HasKey(history => history.Id);

        builder.Property(history => history.Version).IsRowVersion();

        builder.Property(history => history.TenantId).IsRequired();
        builder.Property(history => history.SessionId).IsRequired();

        builder.Property(history => history.SourceFileName)
            .HasMaxLength(260)
            .IsRequired();

        builder.Property(history => history.SourceFileSizeBytes)
            .IsRequired();

        builder.Property(history => history.SourceRowCount)
            .IsRequired();

        builder.Property(history => history.ValidRowCount)
            .IsRequired();

        builder.Property(history => history.CreatedCount)
            .IsRequired();

        builder.Property(history => history.SkippedCount)
            .IsRequired();

        builder.Property(history => history.Status)
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(history => history.AppliedAt)
            .IsRequired();

        builder.Property(history => history.ActorFullName)
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(history => history.ActorRole)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(history => history.FailureReason)
            .HasMaxLength(2048)
            .IsRequired(false);

        builder.Property(history => history.CreatedBy).HasMaxLength(256);
        builder.Property(history => history.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(history => history.TenantId)
            .HasDatabaseName("IX_EmployeeImportHistories_TenantId");

        builder.HasIndex(history => new { history.TenantId, history.AppliedAt })
            .HasDatabaseName("IX_EmployeeImportHistories_TenantId_AppliedAt");

        builder.HasIndex(history => history.SessionId)
            .IsUnique()
            .HasDatabaseName("IX_EmployeeImportHistories_SessionId");
    }
}