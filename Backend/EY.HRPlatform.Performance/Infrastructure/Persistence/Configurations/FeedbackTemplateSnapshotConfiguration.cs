using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class FeedbackTemplateSnapshotConfiguration : IEntityTypeConfiguration<FeedbackTemplateSnapshot>
{
    public void Configure(EntityTypeBuilder<FeedbackTemplateSnapshot> builder)
    {
        builder.ToTable("FeedbackTemplateSnapshots");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.FeedbackType).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(item => item.Name).HasMaxLength(200).IsRequired();
        builder.HasIndex(item => new { item.TenantId, item.CycleId, item.FeedbackType }).IsUnique();
        builder.HasMany(item => item.Prompts).WithOne().HasForeignKey(item => item.TemplateSnapshotId).OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(FeedbackTemplateSnapshot.Prompts))!.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Ignore(item => item.DomainEvents);
    }
}
