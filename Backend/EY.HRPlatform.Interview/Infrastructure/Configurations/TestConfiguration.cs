using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Interview.Infrastructure.Configurations;

public class TestConfiguration : IEntityTypeConfiguration<Test>
{
    public void Configure(EntityTypeBuilder<Test> builder)
    {
        builder.ToTable("Tests");
        builder.HasKey(t => t.Id);

        builder.Ignore(t => t.CreatedBy);
        builder.Ignore(t => t.UpdatedBy);

        builder.Property(t => t.Title).IsRequired().HasMaxLength(200);
        builder.Property(t => t.Description).HasMaxLength(4000);

        builder.Property(t => t.Discipline)
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(t => t.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired()
            .ValueGeneratedNever();

        builder.Property(t => t.MaxAttempts)
            .IsRequired(false);

        builder.Property(t => t.AllowSkipping)
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(t => t.AllowBacktracking)
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(t => t.ShowProgressBar)
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(t => t.RandomizeOrder)
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(t => t.EnableProctoring)
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(t => t.EnableActivityMonitoring)
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(t => t.RestrictCopyPaste)
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(t => t.PassingThreshold)
            .IsRequired(false);

        builder.Property(t => t.CandidateCount)
            .HasDefaultValue(0)
            .IsRequired();

        builder.Property(t => t.CreatedAt).IsRequired();
        builder.Property(t => t.UpdatedAt).IsRequired();

        builder.HasIndex(t => t.CreatedAt);
        builder.HasIndex(t => t.Discipline);
        builder.HasIndex(t => t.Status);
        builder.HasIndex(t => t.CandidateCount);
    }
}