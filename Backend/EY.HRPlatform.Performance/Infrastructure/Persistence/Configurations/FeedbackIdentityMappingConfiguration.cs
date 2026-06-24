using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class FeedbackIdentityMappingConfiguration : IEntityTypeConfiguration<FeedbackIdentityMapping>
{
    public void Configure(EntityTypeBuilder<FeedbackIdentityMapping> builder)
    {
        builder.ToTable("FeedbackIdentityMappings");
        builder.HasKey(item => item.Id);
        builder.HasIndex(item => item.ResponseContentId).IsUnique();
        builder.HasOne<FeedbackResponseContent>()
            .WithMany()
            .HasForeignKey(item => item.ResponseContentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
