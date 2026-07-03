using EY.HRPlatform.Performance.Domain.Entities.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations.Platform;

public class PlatformObjectiveBaselineConfiguration : IEntityTypeConfiguration<PlatformObjectiveBaseline>
{
    public void Configure(EntityTypeBuilder<PlatformObjectiveBaseline> builder)
    {
        builder.ToTable("PlatformObjectiveBaselines");
        builder.HasKey(b => b.Id);

        builder.Property(b => b.CreatedBy).HasMaxLength(256);
        builder.Property(b => b.UpdatedBy).HasMaxLength(256);

        builder.Ignore(b => b.PublishedVersion);

        builder.HasMany(b => b.Versions)
            .WithOne()
            .HasForeignKey(v => v.BaselineId)
            .OnDelete(DeleteBehavior.Cascade);

        // No global query filter — platform-scoped entity (D1)
    }
}
