using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public class EmployeeImportApplyOperationConfiguration : IEntityTypeConfiguration<EmployeeImportApplyOperation>
{
    public void Configure(EntityTypeBuilder<EmployeeImportApplyOperation> builder)
    {
        builder.ToTable("EmployeeImportApplyOperations");
        builder.HasKey(operation => operation.Id);

        builder.Property(operation => operation.Version).IsRowVersion();
        builder.Property(operation => operation.TenantId).IsRequired();
        builder.Property(operation => operation.SessionId).IsRequired();

        builder.Property(operation => operation.Status)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(operation => operation.ActorUserId).IsRequired();
        builder.Property(operation => operation.ActorFullName).HasMaxLength(256).IsRequired();
        builder.Property(operation => operation.ActorRole).HasMaxLength(128).IsRequired();
        builder.Property(operation => operation.QueuedAt).IsRequired();
        builder.Property(operation => operation.ProcessedRowCount).IsRequired();
        builder.Property(operation => operation.LockedBy).HasMaxLength(64).IsRequired(false);
        builder.Property(operation => operation.FailureReason).HasMaxLength(2000).IsRequired(false);
        builder.Property(operation => operation.CreatedBy).HasMaxLength(256);
        builder.Property(operation => operation.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(operation => operation.TenantId)
            .HasDatabaseName("IX_EmployeeImportApplyOperations_TenantId");

        builder.HasIndex(operation => new { operation.TenantId, operation.SessionId, operation.CreatedAt })
            .HasDatabaseName("IX_EmployeeImportApplyOperations_TenantId_SessionId_CreatedAt");

        builder.HasIndex(operation => new { operation.Status, operation.LockedAt, operation.CreatedAt })
            .HasDatabaseName("IX_EmployeeImportApplyOperations_Status_LockedAt_CreatedAt");
    }
}
