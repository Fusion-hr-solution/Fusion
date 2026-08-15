using EY.HRPlatform.CoreHR.Features.OrganizationImport;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public sealed class OrganizationImportSessionConfiguration : IEntityTypeConfiguration<OrganizationImportSession>
{
    public void Configure(EntityTypeBuilder<OrganizationImportSession> builder)
    {
        builder.ToTable("OrganizationImportSessions");
        builder.HasKey(session => session.Id);
        builder.Property(session => session.Version).IsRowVersion();
        builder.Property(session => session.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(session => session.EffectiveDate).IsRequired();
        builder.Property(session => session.CreationFingerprint).HasMaxLength(64).IsRequired();
        builder.Property(session => session.StartedByDisplayName).HasMaxLength(256).IsRequired();
        builder.Property(session => session.LastUpdatedByDisplayName).HasMaxLength(256).IsRequired();
        builder.Property(session => session.DecisionsJson).HasColumnType("jsonb").HasDefaultValueSql("'{}'::jsonb").IsRequired();
        builder.Property(session => session.DecisionsUpdatedByDisplayName).HasMaxLength(256);
        builder.Property(session => session.CommittedByDisplayName).HasMaxLength(256);
        builder.Property(session => session.FinalSemanticDigest).HasMaxLength(64);
        builder.Property(session => session.CommitResultJson).HasColumnType("jsonb");
        builder.Property(session => session.FinalProvenanceJson).HasColumnType("jsonb");
        builder.Property(session => session.CreatedBy).HasMaxLength(256);
        builder.Property(session => session.UpdatedBy).HasMaxLength(256);
        builder.HasIndex(session => new { session.TenantId, session.CreationToken })
            .IsUnique()
            .HasDatabaseName("UX_OrganizationImportSessions_Tenant_CreationToken");
        builder.HasIndex(session => new { session.TenantId, session.Status, session.UpdatedAt })
            .HasDatabaseName("IX_OrganizationImportSessions_Tenant_Status_UpdatedAt");
        builder.HasOne(session => session.Source)
            .WithOne(source => source.Session)
            .HasForeignKey<OrganizationImportSource>(source => source.SessionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class OrganizationImportSourceConfiguration : IEntityTypeConfiguration<OrganizationImportSource>
{
    public void Configure(EntityTypeBuilder<OrganizationImportSource> builder)
    {
        builder.ToTable("OrganizationImportSources");
        builder.HasKey(source => source.Id);
        builder.Property(source => source.OriginalFileName).HasMaxLength(255).IsRequired();
        builder.Property(source => source.SourceFormat).HasMaxLength(16).IsRequired();
        builder.Property(source => source.ContentType).HasMaxLength(128).IsRequired();
        builder.Property(source => source.Sha256).HasMaxLength(64).IsRequired();
        builder.Property(source => source.SelectedSheetName).HasMaxLength(128).IsRequired();
        builder.Property(source => source.SelectedRange).HasMaxLength(32).IsRequired();
        builder.Property(source => source.SourceTableJson).HasColumnType("jsonb");
        builder.Property(source => source.RawBytes).HasColumnType("bytea");
        builder.Property(source => source.CreatedBy).HasMaxLength(256);
        builder.Property(source => source.UpdatedBy).HasMaxLength(256);
        builder.HasIndex(source => source.TenantId)
            .HasDatabaseName("IX_OrganizationImportSources_TenantId");
        builder.HasIndex(source => source.SessionId).IsUnique();
    }
}

public sealed class OrganizationImportSemanticAttemptConfiguration : IEntityTypeConfiguration<OrganizationImportSemanticAttempt>
{
    public void Configure(EntityTypeBuilder<OrganizationImportSemanticAttempt> builder)
    {
        builder.ToTable("OrganizationImportSemanticAttempts");
        builder.HasKey(attempt => attempt.Id);
        builder.Property(attempt => attempt.Version).IsConcurrencyToken();
        builder.Property(attempt => attempt.ContractVersion).HasMaxLength(80).IsRequired();
        builder.Property(attempt => attempt.InputFingerprint).HasMaxLength(64).IsRequired();
        builder.Property(attempt => attempt.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(attempt => attempt.Provider).HasMaxLength(32).IsRequired();
        builder.Property(attempt => attempt.Model).HasMaxLength(128).IsRequired();
        builder.Property(attempt => attempt.EligibleIssueKeysJson).HasColumnType("jsonb").IsRequired();
        builder.Property(attempt => attempt.SuggestionsJson).HasColumnType("jsonb").IsRequired();
        builder.Property(attempt => attempt.ReviewOutcomesJson).HasColumnType("jsonb");
        builder.Property(attempt => attempt.FailureCategory).HasConversion<string>().HasMaxLength(24);
        builder.Property(attempt => attempt.AppliedByDisplayName).HasMaxLength(256);
        builder.Property(attempt => attempt.CreatedBy).HasMaxLength(256);
        builder.Property(attempt => attempt.UpdatedBy).HasMaxLength(256);
        builder.HasIndex(attempt => new
            {
                attempt.TenantId,
                attempt.SessionId,
                attempt.InputFingerprint,
                attempt.AttemptOrdinal,
            })
            .IsUnique()
            .HasDatabaseName("UX_OrganizationImportSemanticAttempts_Tenant_Session_Fingerprint_Ordinal");
        builder.HasIndex(attempt => new { attempt.TenantId, attempt.SessionId, attempt.Status })
            .HasDatabaseName("IX_OrganizationImportSemanticAttempts_Tenant_Session_Status");
        builder.HasOne<OrganizationImportSession>()
            .WithMany()
            .HasForeignKey(attempt => attempt.SessionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
