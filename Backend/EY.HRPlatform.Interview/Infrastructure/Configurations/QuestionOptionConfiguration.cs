using EY.HRPlatform.Interview.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Interview.Infrastructure.Configurations;

public class QuestionOptionConfiguration : IEntityTypeConfiguration<QuestionOption>
{
    public void Configure(EntityTypeBuilder<QuestionOption> builder)
    {
        builder.ToTable("QuestionOptions");
        builder.HasKey(o => o.Id);

        builder.Ignore(o => o.CreatedAt);
        builder.Ignore(o => o.UpdatedAt);
        builder.Ignore(o => o.CreatedBy);
        builder.Ignore(o => o.UpdatedBy);

        builder.Property(o => o.Text).IsRequired().HasMaxLength(1000);
        builder.HasIndex(o => o.QuestionId);
    }
}
