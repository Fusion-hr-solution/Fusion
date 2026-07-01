using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class FeedbackResponseVersionConfiguration : IEntityTypeConfiguration<FeedbackResponseVersion>
{
    public void Configure(EntityTypeBuilder<FeedbackResponseVersion> builder)
    {
        builder.ToTable("FeedbackResponseVersions");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.AnswersJson).IsRequired();
        builder.Property(item => item.GeneralComment).HasMaxLength(4000);
        builder.HasOne<FeedbackResponseContent>()
            .WithMany()
            .HasForeignKey(item => item.ResponseContentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
