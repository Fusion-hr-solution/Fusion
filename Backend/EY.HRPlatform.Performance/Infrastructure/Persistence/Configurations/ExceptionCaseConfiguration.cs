using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class ExceptionCaseConfiguration : IEntityTypeConfiguration<ExceptionCase>
{
    public void Configure(EntityTypeBuilder<ExceptionCase> builder)
    {
        builder.ToTable("ExceptionCases");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.SourceWorkItemType).HasConversion<string>().HasMaxLength(40).IsRequired();
        builder.Property(item => item.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(item => item.ResolutionAction).HasConversion<string>().HasMaxLength(20);
        builder.Property(item => item.FrozenReason).HasMaxLength(2000).IsRequired();
        builder.Property(item => item.FailureCode).HasMaxLength(200).IsRequired();
        builder.Property(item => item.FrozenWorkflowContextJson).HasMaxLength(8000).IsRequired();

        builder.HasIndex(item => item.TenantId);
        builder.HasIndex(item => new { item.CycleId, item.Status });
        builder.HasIndex(item => new { item.TenantId, item.SourceWorkItemId, item.SourceObjectId, item.FailureCode, item.Status })
            .HasFilter($"\"Status\" = '{ExceptionCaseStatus.Open}'")
            .IsUnique();

        builder.HasMany(item => item.HistoryEntries)
            .WithOne()
            .HasForeignKey(entry => entry.ExceptionCaseId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Ignore(item => item.DomainEvents);
    }
}
