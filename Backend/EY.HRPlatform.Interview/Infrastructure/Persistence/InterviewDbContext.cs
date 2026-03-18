using EY.HRPlatform.Interview.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Infrastructure.Persistence;

public class InterviewDbContext : DbContext
{
    public InterviewDbContext(DbContextOptions<InterviewDbContext> options)
        : base(options)
    {
    }

    // QuestionBank Module
    public DbSet<Question> Questions { get; set; } = null!;
    public DbSet<QuestionOption> QuestionOptions { get; set; } = null!;

    // Tests Module
    public DbSet<InterviewTest> InterviewTests { get; set; } = null!;
    public DbSet<InterviewTestConfig> InterviewTestConfigs { get; set; } = null!;
    public DbSet<InterviewTestQuestion> InterviewTestQuestions { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ==================== QUESTION BANK SCHEMA ====================

        modelBuilder.Entity<Question>(entity =>
        {
            entity.ToTable("questions", "interview");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Title)
                .IsRequired()
                .HasMaxLength(500);

            entity.Property(e => e.Description)
                .HasMaxLength(2000);

            entity.Property(e => e.Type)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.Difficulty)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.GradingMethod)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.Tags)
                .HasConversion(
                    v => string.Join(',', v),
                    v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList());

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.HasMany(e => e.Options)
                .WithOne(o => o.Question)
                .HasForeignKey(o => o.QuestionId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.Type);
            entity.HasIndex(e => e.Difficulty);
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => e.CreatedAt);
        });

        modelBuilder.Entity<QuestionOption>(entity =>
        {
            entity.ToTable("question_options", "interview");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Text)
                .IsRequired()
                .HasMaxLength(1000);

            entity.HasIndex(e => e.QuestionId);
        });

        // ==================== TESTS SCHEMA ====================

        modelBuilder.Entity<InterviewTest>(entity =>
        {
            entity.ToTable("interview_tests", "interview");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Title)
                .IsRequired()
                .HasMaxLength(500);

            entity.Property(e => e.Role)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(e => e.Discipline)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(e => e.Description)
                .HasMaxLength(2000);

            entity.Property(e => e.DifficultyLevel)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.Status)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.HasOne(e => e.Config)
                .WithOne(c => c.Test)
                .HasForeignKey<InterviewTestConfig>(c => c.TestId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(e => e.Questions)
                .WithOne(q => q.Test)
                .HasForeignKey(q => q.TestId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => e.CreatedAt);
        });

        modelBuilder.Entity<InterviewTestConfig>(entity =>
        {
            entity.ToTable("interview_test_configs", "interview");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.AccessType)
                .IsRequired()
                .HasMaxLength(50);

            entity.HasIndex(e => e.TestId).IsUnique();
        });

        modelBuilder.Entity<InterviewTestQuestion>(entity =>
        {
            entity.ToTable("interview_test_questions", "interview");
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => new { e.TestId, e.SortOrder });
            entity.HasIndex(e => e.QuestionId);
        });
    }
}