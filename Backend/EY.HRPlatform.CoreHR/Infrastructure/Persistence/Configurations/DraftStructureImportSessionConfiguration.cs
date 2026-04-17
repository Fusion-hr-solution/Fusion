using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public class DraftStructureImportSessionConfiguration : IEntityTypeConfiguration<DraftStructureImportSession>
{
    public void Configure(EntityTypeBuilder<DraftStructureImportSession> builder)
    {
        builder.ToTable("DraftStructureImportSessions");
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

        builder.Property(session => session.MappingJson)
            .HasColumnType("jsonb")
            .IsRequired(false);

        builder.Property(session => session.KindReconciliationsJson)
            .HasColumnType("jsonb")
            .IsRequired(false);

        builder.Property(session => session.NormalizedRowsJson)
            .HasColumnType("jsonb")
            .IsRequired(false);

        builder.Property(session => session.ValidationIssuesJson)
            .HasColumnType("jsonb")
            .IsRequired(false);

        builder.Property(session => session.SchemaFingerprint)
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(session => session.DraftWatermark)
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(session => session.CreatedBy).HasMaxLength(256);
        builder.Property(session => session.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(session => session.TenantId)
            .HasDatabaseName("IX_DraftStructureImportSessions_TenantId");

        builder.HasIndex(session => new { session.TenantId, session.Stage })
            .HasDatabaseName("IX_DraftStructureImportSessions_TenantId_Stage");

        builder.HasIndex(session => session.ExpiresAt)
            .HasDatabaseName("IX_DraftStructureImportSessions_ExpiresAt");
    }
}