using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class FeedbackResponseContentConfiguration : IEntityTypeConfiguration<FeedbackResponseContent>
{
    public void Configure(EntityTypeBuilder<FeedbackResponseContent> builder)
    {
        builder.ToTable("FeedbackResponseContents");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.FeedbackType).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(item => item.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(item => item.InvalidationReason).HasMaxLength(2000);
        builder.HasMany(item => item.Answers).WithOne().HasForeignKey(item => item.ResponseContentId).OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(FeedbackResponseContent.Answers))!.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Ignore(item => item.DomainEvents);
    }
}
