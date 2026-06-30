using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.Text.Json;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class ObjectiveTemplateRevisionConfiguration : IEntityTypeConfiguration<ObjectiveTemplateRevision>
{
    public void Configure(EntityTypeBuilder<ObjectiveTemplateRevision> builder)
    {
        builder.ToTable("ObjectiveTemplateRevisions");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Version).IsRowVersion();

        builder.Property(r => r.TenantId).IsRequired();
        builder.Property(r => r.TemplateId).IsRequired();
        builder.Property(r => r.VersionNumber).IsRequired();

        builder.Property(r => r.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired()
            .HasDefaultValue(ObjectiveTemplateRevisionStatus.Draft);

        builder.Property(r => r.Title).HasMaxLength(200).IsRequired();
        builder.Property(r => r.Description).HasMaxLength(2000);
        builder.Property(r => r.CategoryId);
        builder.Property(r => r.MeasurementType).HasMaxLength(20).IsRequired();
        builder.Property(r => r.SuggestedWeighting).HasPrecision(5, 2);
        builder.Property(r => r.Tags).HasMaxLength(500);

        builder.Property(r => r.TargetValue).HasPrecision(18, 4);
        builder.Property(r => r.Unit).HasMaxLength(50);
        builder.Property(r => r.SuccessCriteria).HasMaxLength(1000);

        builder.Property(r => r.SourceRevisionId);
        builder.Property(r => r.CreatedByUserId).HasMaxLength(256).IsRequired();
        builder.Property(r => r.CreatedByName).HasMaxLength(256);
        builder.Property(r => r.ActivatedAt);
        builder.Property(r => r.ActivatedByUserId).HasMaxLength(256);
        builder.Property(r => r.ActivatedByName).HasMaxLength(256);
        builder.Property(r => r.ChangeSummary).HasMaxLength(1000);
        builder.Property(r => r.SupersededAt);

        builder.Property(r => r.ApplicableOrgUnitIds)
            .HasConversion(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => (IReadOnlyList<Guid>)(JsonSerializer.Deserialize<List<Guid>>(v, (JsonSerializerOptions?)null) ?? new List<Guid>()))
            .HasColumnType("text")
            .HasDefaultValueSql("'[]'");

        builder.Property(r => r.ApplicableJobTitles)
            .HasConversion(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => (IReadOnlyList<string>)(JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>()))
            .HasColumnType("text")
            .HasDefaultValueSql("'[]'");

        builder.Property(r => r.ApplicableWorkLocations)
            .HasConversion(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => (IReadOnlyList<string>)(JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>()))
            .HasColumnType("text")
            .HasDefaultValueSql("'[]'");

        builder.Property(r => r.ApplicableEmploymentTypes)
            .HasConversion(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => (IReadOnlyList<string>)(JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>()))
            .HasColumnType("text")
            .HasDefaultValueSql("'[]'");

        builder.Property(r => r.ApplicabilityValidationState)
            .HasMaxLength(20)
            .IsRequired()
            .HasDefaultValue("NotValidated");

        builder.HasOne(r => r.Category)
            .WithMany()
            .HasForeignKey(r => r.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(r => r.TemplateId)
            .HasDatabaseName("IX_ObjectiveTemplateRevisions_TemplateId");

        builder.HasIndex(r => new { r.TemplateId, r.Status })
            .HasDatabaseName("IX_ObjectiveTemplateRevisions_TemplateId_Status");

        builder.HasIndex(r => r.TenantId)
            .HasDatabaseName("IX_ObjectiveTemplateRevisions_TenantId");

        builder.HasIndex(r => new { r.TemplateId, r.VersionNumber })
            .IsUnique()
            .HasDatabaseName("IX_ObjectiveTemplateRevisions_TemplateId_VersionNumber");
    }
}
