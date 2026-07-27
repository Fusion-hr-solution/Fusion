using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class AttachmentBlobConfiguration : IEntityTypeConfiguration<AttachmentBlob>
{
    public void Configure(EntityTypeBuilder<AttachmentBlob> builder)
    {
        builder.ToTable("AttachmentBlobs");
        builder.HasKey(blob => blob.Id);

        builder.Property(blob => blob.StorageKey)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(blob => blob.Content)
            .HasColumnType("bytea")
            .IsRequired();

        // One row per storage key: the key is the identity the storage abstraction addresses by.
        builder.HasIndex(blob => blob.StorageKey)
            .IsUnique()
            .HasDatabaseName("IX_AttachmentBlobs_StorageKey");
    }
}
