using System.Text.Json;
using EY.HRPlatform.Interview.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Interview.Infrastructure.Configurations;

public class QuestionConfiguration : IEntityTypeConfiguration<Question>
{
    public void Configure(EntityTypeBuilder<Question> builder)
    {
        builder.ToTable("Questions");
        builder.HasKey(q => q.Id);

        // Keep Interview schema backward-compatible while using shared base entities.
        builder.Ignore(q => q.CreatedBy);
        builder.Ignore(q => q.UpdatedBy);

        builder.Property(q => q.Title).IsRequired().HasMaxLength(200);
        builder.Property(q => q.Description).HasMaxLength(4000);

        builder.Property(q => q.Type)
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(q => q.Difficulty)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(q => q.GradingMethod)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        var tagsProperty = builder.Property(q => q.Tags)
            .HasConversion(
                tags => JsonSerializer.Serialize(tags, JsonSerializerOptions.Default),
                value => JsonSerializer.Deserialize<List<string>>(value, JsonSerializerOptions.Default) ?? new List<string>())
            .IsRequired();

        tagsProperty.Metadata.SetValueComparer(
            new ValueComparer<List<string>>(
                (c1, c2) => c1 != null && c2 != null && c1.SequenceEqual(c2),
                c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                c => c.ToList()));

        builder.Property(q => q.Language).HasMaxLength(80);
        builder.Property(q => q.StarterCode);
        builder.Property(q => q.EvaluationCriteria).HasMaxLength(4000);
        builder.Property(q => q.TestCases);
        builder.Property(q => q.UsageCount).HasDefaultValue(0);
        builder.Property(q => q.CreatedAt).IsRequired();
        builder.Property(q => q.UpdatedAt).IsRequired();

        builder.HasIndex(q => q.CreatedAt);
        builder.HasIndex(q => q.UsageCount);
        builder.HasIndex(q => q.Type);
        builder.HasIndex(q => q.Difficulty);
        builder.HasIndex(q => q.GradingMethod);

        builder.HasMany(q => q.Options)
            .WithOne(o => o.Question)
            .HasForeignKey(o => o.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}