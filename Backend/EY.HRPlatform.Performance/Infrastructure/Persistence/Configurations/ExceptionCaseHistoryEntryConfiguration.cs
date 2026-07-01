using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class ExceptionCaseHistoryEntryConfiguration : IEntityTypeConfiguration<ExceptionCaseHistoryEntry>
{
    public void Configure(EntityTypeBuilder<ExceptionCaseHistoryEntry> builder)
    {
        builder.ToTable("ExceptionCaseHistoryEntries");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.AttemptType).HasMaxLength(100).IsRequired();
        builder.Property(item => item.Action).HasConversion<string>().HasMaxLength(20);
        builder.Property(item => item.Reason).HasMaxLength(2000).IsRequired();
        builder.Property(item => item.Outcome).HasMaxLength(200).IsRequired();

        builder.HasIndex(item => item.TenantId);
        builder.HasIndex(item => new { item.ExceptionCaseId, item.OccurredAt });
    }
}
