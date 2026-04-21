using EY.HRPlatform.Interview.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Interview.Infrastructure.Configurations;

public class CandidateLinkSecuritySettingsConfiguration : IEntityTypeConfiguration<CandidateLinkSecuritySettings>
{
    public void Configure(EntityTypeBuilder<CandidateLinkSecuritySettings> builder)
    {
        builder.ToTable("CandidateLinkSecuritySettings");
        builder.HasKey(x => x.Id);

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.UpdatedBy);

        builder.Property(x => x.TestId)
            .IsRequired();

        builder.Property(x => x.SingleUseLinkEnabled)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(x => x.EmailVerificationEnabled)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(x => x.IpLockEnabled)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(x => x.BrowserFingerprintEnabled)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(x => x.LinkValidForValue)
            .IsRequired()
            .HasDefaultValue(7);

        builder.Property(x => x.LinkValidForUnit)
            .IsRequired()
            .HasMaxLength(16)
            .HasDefaultValue("days");

        builder.Property(x => x.GracePeriodValue)
            .IsRequired()
            .HasDefaultValue(30);

        builder.Property(x => x.GracePeriodUnit)
            .IsRequired()
            .HasMaxLength(16)
            .HasDefaultValue("minutes");

        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);

        builder.HasIndex(x => x.TestId).IsUnique();

        builder.HasOne(x => x.Test)
            .WithMany()
            .HasForeignKey(x => x.TestId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
