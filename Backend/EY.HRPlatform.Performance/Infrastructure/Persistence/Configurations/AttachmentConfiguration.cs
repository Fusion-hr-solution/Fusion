using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public class AttachmentConfiguration : IEntityTypeConfiguration<Attachment>
{
    public void Configure(EntityTypeBuilder<Attachment> builder)
    {
        builder.ToTable("Attachments");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.TenantId).IsRequired();
        builder.Property(a => a.OwnerType).HasMaxLength(120).IsRequired();
        builder.Property(a => a.OwnerId);
        builder.Property(a => a.UploaderUserId).IsRequired();
        builder.Property(a => a.FileName).HasMaxLength(400).IsRequired();
        builder.Property(a => a.ContentType).HasMaxLength(150).IsRequired();
        builder.Property(a => a.SizeBytes).IsRequired();
        builder.Property(a => a.StorageKey).HasMaxLength(200).IsRequired();
        builder.Property(a => a.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(a => a.CommittedAt);
        builder.Property(a => a.CreatedBy).HasMaxLength(256);
        builder.Property(a => a.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(a => new { a.TenantId, a.OwnerType, a.OwnerId })
            .HasDatabaseName("IX_Attachments_Tenant_Owner");

        // Cleanup sweep scans pending rows by age.
        builder.HasIndex(a => new { a.Status, a.CreatedAt })
            .HasDatabaseName("IX_Attachments_Status_CreatedAt");
    }
}
