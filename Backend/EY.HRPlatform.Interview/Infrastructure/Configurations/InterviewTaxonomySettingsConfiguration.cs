using EY.HRPlatform.Interview.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Interview.Infrastructure.Configurations;

public class InterviewTaxonomySettingsConfiguration : IEntityTypeConfiguration<InterviewTaxonomySettings>
{
    public void Configure(EntityTypeBuilder<InterviewTaxonomySettings> builder)
    {
        builder.ToTable("InterviewTaxonomySettings");
        builder.HasKey(x => x.Id);

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.UpdatedBy);

        builder.Property(x => x.OverridesJson)
            .IsRequired()
            .HasDefaultValue("{}");

        builder.Property(x => x.Version)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);
    }
}
