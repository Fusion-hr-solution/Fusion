using EY.HRPlatform.Interview.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Interview.Infrastructure.Configurations;

public class QuestionGradeResultConfiguration : IEntityTypeConfiguration<QuestionGradeResult>
{
    public void Configure(EntityTypeBuilder<QuestionGradeResult> builder)
    {
        builder.ToTable("QuestionGradeResults");
        builder.HasKey(x => x.Id);

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.UpdatedBy);
        builder.Ignore(x => x.UpdatedAt);

        builder.Property(x => x.GraderType).IsRequired().HasMaxLength(50);
        builder.Property(x => x.Score).HasPrecision(5, 2).IsRequired();
        builder.Property(x => x.MaxScore).HasPrecision(5, 2).IsRequired();
        builder.Property(x => x.Feedback).HasMaxLength(4000);
        builder.Property(x => x.NeedsHumanReview).HasDefaultValue(false).IsRequired();
        builder.Property(x => x.ReviewedBy).HasMaxLength(320);

        // One grade result per (attempt, question). A unique index enforces this at the
        // DB level so duplicates are impossible even if two workers grade the same attempt
        // concurrently (e.g. after a stale-lock reclaim) — the second insert fails and its
        // transaction rolls back. The composite also serves AttemptId-prefix lookups, so a
        // separate AttemptId index is unnecessary.
        builder.HasIndex(x => new { x.AttemptId, x.QuestionId }).IsUnique();
        builder.HasIndex(x => new { x.NeedsHumanReview, x.ReviewedAt });

        builder.HasOne(x => x.Attempt)
            .WithMany()
            .HasForeignKey(x => x.AttemptId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Question)
            .WithMany()
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
