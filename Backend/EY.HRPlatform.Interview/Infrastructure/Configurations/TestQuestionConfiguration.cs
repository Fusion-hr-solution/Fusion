using EY.HRPlatform.Interview.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Interview.Infrastructure.Configurations;

public class TestQuestionConfiguration : IEntityTypeConfiguration<TestQuestion>
{
    public void Configure(EntityTypeBuilder<TestQuestion> builder)
    {
        builder.ToTable("TestQuestions");
        builder.HasKey(tq => tq.Id);

        builder.Ignore(tq => tq.CreatedAt);
        builder.Ignore(tq => tq.UpdatedAt);
        builder.Ignore(tq => tq.CreatedBy);
        builder.Ignore(tq => tq.UpdatedBy);

        builder.HasIndex(tq => tq.TestId);
        builder.HasIndex(tq => tq.QuestionId);
        builder.HasIndex(tq => new { tq.TestId, tq.QuestionId }).IsUnique();

        builder.HasOne(tq => tq.Test)
            .WithMany(t => t.TestQuestions)
            .HasForeignKey(tq => tq.TestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(tq => tq.Question)
            .WithMany()
            .HasForeignKey(tq => tq.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
