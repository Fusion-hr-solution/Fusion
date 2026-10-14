using EY.HRPlatform.Performance.Domain.Progress;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class EvidenceUploadConfiguration : IEntityTypeConfiguration<EvidenceUpload>
{
    public void Configure(EntityTypeBuilder<EvidenceUpload> builder)
    {
        builder.ToTable("EvidenceUploads");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Version).IsRowVersion();
        builder.Property(e => e.StorageKey).IsRequired().HasMaxLength(300);
        builder.Property(e => e.FileName).IsRequired().HasMaxLength(250);
        builder.Property(e => e.ContentType).IsRequired().HasMaxLength(150);
        builder.HasIndex(e => new { e.TenantId, e.CreatedAt }).HasFilter("\"ClaimedAt\" IS NULL");
    }
}
