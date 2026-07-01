using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class FeedbackPromptSnapshotConfiguration : IEntityTypeConfiguration<FeedbackPromptSnapshot>
{
    public void Configure(EntityTypeBuilder<FeedbackPromptSnapshot> builder)
    {
        builder.ToTable("FeedbackPromptSnapshots");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.PromptText).HasMaxLength(2000).IsRequired();
        builder.Property(item => item.Description).HasMaxLength(2000);
        builder.HasOne<FeedbackTemplateSnapshot>()
            .WithMany()
            .HasForeignKey(item => item.TemplateSnapshotId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
