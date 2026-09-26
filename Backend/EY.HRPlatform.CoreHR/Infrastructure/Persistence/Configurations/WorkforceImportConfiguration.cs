using EY.HRPlatform.CoreHR.Features.Employees.Import;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public sealed class WorkforceImportSessionConfiguration : IEntityTypeConfiguration<WorkforceImportSession>
{
    public void Configure(EntityTypeBuilder<WorkforceImportSession> builder)
    {
        builder.ToTable("WorkforceImportSessions");
        builder.HasKey(session => session.Id);
        builder.Property(session => session.Version).IsRowVersion();
        builder.Property(session => session.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(session => session.BaselineDate).IsRequired();
        builder.Property(session => session.CreationFingerprint).HasMaxLength(64).IsRequired();
        builder.Property(session => session.SelectedSheetName).HasMaxLength(128).IsRequired();
        builder.Property(session => session.StartedByDisplayName).HasMaxLength(256).IsRequired();
        builder.Property(session => session.LastUpdatedByDisplayName).HasMaxLength(256).IsRequired();
        builder.Property(session => session.MappingPlanJson).HasColumnType("jsonb").HasDefaultValueSql("'{}'::jsonb").IsRequired();
        builder.Property(session => session.ResolutionsJson).HasColumnType("jsonb").HasDefaultValueSql("'{}'::jsonb").IsRequired();
        builder.Property(session => session.DecisionsUpdatedByDisplayName).HasMaxLength(256);
        builder.Property(session => session.ProposalFingerprint).HasMaxLength(64);
        builder.Property(session => session.CommittedByDisplayName).HasMaxLength(256);
        builder.Property(session => session.FinalProposalFingerprint).HasMaxLength(64);
        builder.Property(session => session.CommitResultJson).HasColumnType("jsonb");
        builder.Property(session => session.FinalProvenanceJson).HasColumnType("jsonb");
        builder.Property(session => session.CreatedBy).HasMaxLength(256);
        builder.Property(session => session.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(session => new { session.TenantId, session.CreationToken })
            .IsUnique()
            .HasDatabaseName("UX_WorkforceImportSessions_Tenant_CreationToken");
        builder.HasIndex(session => new { session.TenantId, session.Status, session.UpdatedAt })
            .HasDatabaseName("IX_WorkforceImportSessions_Tenant_Status_UpdatedAt");

        builder.HasOne(session => session.Source)
            .WithOne(source => source.Session)
            .HasForeignKey<WorkforceImportSource>(source => source.SessionId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(session => session.Rows)
            .WithOne()
            .HasForeignKey(row => row.SessionId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(session => session.Rows).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

public sealed class WorkforceImportSourceConfiguration : IEntityTypeConfiguration<WorkforceImportSource>
{
    public void Configure(EntityTypeBuilder<WorkforceImportSource> builder)
    {
        builder.ToTable("WorkforceImportSources");
        builder.HasKey(source => source.Id);
        builder.Property(source => source.OriginalFileName).HasMaxLength(255).IsRequired();
        builder.Property(source => source.SourceFormat).HasMaxLength(16).IsRequired();
        builder.Property(source => source.ContentType).HasMaxLength(128).IsRequired();
        builder.Property(source => source.Sha256).HasMaxLength(64).IsRequired();
        builder.Property(source => source.SelectedSheetName).HasMaxLength(128).IsRequired();
        builder.Property(source => source.SelectedRange).HasMaxLength(32).IsRequired();
        builder.Property(source => source.ColumnsJson).HasColumnType("jsonb");
        builder.Property(source => source.RawBytes).HasColumnType("bytea");
        builder.Property(source => source.CreatedBy).HasMaxLength(256);
        builder.Property(source => source.UpdatedBy).HasMaxLength(256);
        builder.HasIndex(source => source.TenantId).HasDatabaseName("IX_WorkforceImportSources_TenantId");
        builder.HasIndex(source => source.SessionId).IsUnique();
    }
}

public sealed class WorkforceImportRowConfiguration : IEntityTypeConfiguration<WorkforceImportRow>
{
    public void Configure(EntityTypeBuilder<WorkforceImportRow> builder)
    {
        builder.ToTable("WorkforceImportRows");
        builder.HasKey(row => row.Id);
        builder.Property(row => row.SourceCellsJson).HasColumnType("jsonb");
        builder.Property(row => row.NormalizedProposalJson).HasColumnType("jsonb");
        builder.Property(row => row.IssueStateJson).HasColumnType("jsonb");
        builder.Property(row => row.SearchText).HasColumnType("text");
        builder.Property(row => row.ResolvedManagerKey).HasMaxLength(256);
        builder.Property(row => row.Classification).HasConversion<string>().HasMaxLength(24).IsRequired();
        builder.Property(row => row.CreatedBy).HasMaxLength(256);
        builder.Property(row => row.UpdatedBy).HasMaxLength(256);
        builder.HasIndex(row => new { row.TenantId, row.SessionId, row.SourceRowNumber })
            .IsUnique()
            .HasDatabaseName("UX_WorkforceImportRows_Tenant_Session_SourceRowNumber");
        builder.HasIndex(row => new { row.TenantId, row.SessionId, row.Classification })
            .HasDatabaseName("IX_WorkforceImportRows_Tenant_Session_Classification");
    }
}

public sealed class WorkforceImportApplyOperationConfiguration : IEntityTypeConfiguration<WorkforceImportApplyOperation>
{
    public void Configure(EntityTypeBuilder<WorkforceImportApplyOperation> builder)
    {
        builder.ToTable("WorkforceImportApplyOperations");
        builder.HasKey(op => op.Id);
        builder.Property(op => op.Version).IsRowVersion();
        builder.Property(op => op.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(op => op.Phase).HasMaxLength(24).IsRequired();
        builder.Property(op => op.ActorDisplayName).HasMaxLength(256).IsRequired();
        builder.Property(op => op.ReviewedProposalFingerprint).HasMaxLength(64).IsRequired().HasDefaultValue(string.Empty);
        builder.Property(op => op.ResultJson).HasColumnType("jsonb");
        builder.Property(op => op.ReviewOutdatedJson).HasColumnType("jsonb");
        builder.Property(op => op.FailureReason).HasMaxLength(2000);
        builder.Property(op => op.LockedBy).HasMaxLength(64);
        builder.Property(op => op.CreatedBy).HasMaxLength(256);
        builder.Property(op => op.UpdatedBy).HasMaxLength(256);
        // One operation per session — idempotent Complete-import replay.
        builder.HasIndex(op => new { op.TenantId, op.SessionId }).IsUnique()
            .HasDatabaseName("UX_WorkforceImportApplyOperations_Tenant_Session");
        builder.HasIndex(op => op.Status).HasDatabaseName("IX_WorkforceImportApplyOperations_Status");
    }
}

public sealed class WorkforceImportSemanticAttemptConfiguration : IEntityTypeConfiguration<WorkforceImportSemanticAttempt>
{
    public void Configure(EntityTypeBuilder<WorkforceImportSemanticAttempt> builder)
    {
        builder.ToTable("WorkforceImportSemanticAttempts");
        builder.HasKey(attempt => attempt.Id);
        builder.Property(attempt => attempt.Version).IsConcurrencyToken();
        builder.Property(attempt => attempt.Trigger).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(attempt => attempt.SourceFingerprint).HasMaxLength(256).IsRequired();
        builder.Property(attempt => attempt.InputFingerprint).HasMaxLength(64).IsRequired();
        builder.Property(attempt => attempt.DataContractVersion).HasMaxLength(80).IsRequired();
        builder.Property(attempt => attempt.ResultContractVersion).HasMaxLength(80).IsRequired();
        builder.Property(attempt => attempt.PromptVersion).HasMaxLength(80).IsRequired();
        builder.Property(attempt => attempt.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(attempt => attempt.Provider).HasMaxLength(32).IsRequired();
        builder.Property(attempt => attempt.Model).HasMaxLength(128).IsRequired();
        builder.Property(attempt => attempt.ProviderResponseId).HasMaxLength(128);
        builder.Property(attempt => attempt.ProviderSystemFingerprint).HasMaxLength(128);
        builder.Property(attempt => attempt.DiagnosticCode).HasMaxLength(80);
        builder.Property(attempt => attempt.EligibleIssueKeysJson).HasColumnType("jsonb").IsRequired();
        builder.Property(attempt => attempt.SuggestionsJson).HasColumnType("jsonb").IsRequired();
        builder.Property(attempt => attempt.FailureCategory).HasConversion<string>().HasMaxLength(24);
        builder.Property(attempt => attempt.CreatedBy).HasMaxLength(256);
        builder.Property(attempt => attempt.UpdatedBy).HasMaxLength(256);
        builder.HasIndex(attempt => new { attempt.TenantId, attempt.SessionId, attempt.InputFingerprint, attempt.AttemptOrdinal })
            .IsUnique()
            .HasDatabaseName("UX_WorkforceImportSemanticAttempts_Tenant_Session_Fingerprint_Ordinal");
        builder.HasIndex(attempt => new { attempt.TenantId, attempt.SessionId, attempt.Status })
            .HasDatabaseName("IX_WorkforceImportSemanticAttempts_Tenant_Session_Status");
        builder.HasIndex(attempt => new { attempt.TenantId, attempt.InputFingerprint, attempt.Status })
            .HasDatabaseName("IX_WorkforceImportSemanticAttempts_Tenant_Input_Status");
        builder.HasOne<WorkforceImportSession>()
            .WithMany()
            .HasForeignKey(attempt => attempt.SessionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
