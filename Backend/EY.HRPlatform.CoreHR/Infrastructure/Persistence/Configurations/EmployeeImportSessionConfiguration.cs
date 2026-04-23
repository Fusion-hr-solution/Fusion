using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public class EmployeeImportSessionConfiguration : IEntityTypeConfiguration<EmployeeImportSession>
{
    public void Configure(EntityTypeBuilder<EmployeeImportSession> builder)
    {
        builder.ToTable("EmployeeImportSessions");
        builder.HasKey(session => session.Id);

        builder.Property(session => session.Version).IsRowVersion();

        builder.Property(session => session.TenantId).IsRequired();

        builder.Property(session => session.Stage)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(session => session.SourceFileName)
            .HasMaxLength(260)
            .IsRequired();

        builder.Property(session => session.SourceFileSizeBytes)
            .IsRequired();

        builder.Property(session => session.SourceHeadersJson)
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(session => session.SourceRowsJson)
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(session => session.PreviewRowsJson)
            .HasColumnType("jsonb")
            .IsRequired();

        builder.HasIndex(session => session.TenantId)
            .HasDatabaseName("IX_EmployeeImportSessions_TenantId");

        builder.HasIndex(session => new { session.TenantId, session.Stage })
            .HasDatabaseName("IX_EmployeeImportSessions_TenantId_Stage");

        builder.HasIndex(session => session.ExpiresAt)
            .HasDatabaseName("IX_EmployeeImportSessions_ExpiresAt");
    }
}