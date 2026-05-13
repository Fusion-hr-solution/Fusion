using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public class EmployeeImportFollowUpIssueConfiguration : IEntityTypeConfiguration<EmployeeImportFollowUpIssue>
{
    public void Configure(EntityTypeBuilder<EmployeeImportFollowUpIssue> builder)
    {
        builder.ToTable("EmployeeImportFollowUpIssues");
        builder.HasKey(issue => issue.Id);

        builder.Property(issue => issue.Version).IsRowVersion();

        builder.Property(issue => issue.TenantId).IsRequired();
        builder.Property(issue => issue.EmployeeImportHistoryId).IsRequired();
        builder.Property(issue => issue.EmployeeId).IsRequired();
        builder.Property(issue => issue.SourceRowNumber).IsRequired();

        builder.Property(issue => issue.IssueCode)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(issue => issue.FieldKey)
            .HasMaxLength(64)
            .IsRequired(false);

        builder.Property(issue => issue.CreatedBy).HasMaxLength(256);
        builder.Property(issue => issue.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(issue => issue.TenantId)
            .HasDatabaseName("IX_EmployeeImportFollowUpIssues_TenantId");

        builder.HasIndex(issue => issue.EmployeeImportHistoryId)
            .HasDatabaseName("IX_EmployeeImportFollowUpIssues_HistoryId");

        builder.HasIndex(issue => new { issue.EmployeeImportHistoryId, issue.EmployeeId, issue.IssueCode, issue.FieldKey })
            .IsUnique()
            .HasDatabaseName("IX_EmployeeImportFollowUpIssues_HistoryId_EmployeeId_Issue");
    }
}