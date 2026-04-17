using EY.HRPlatform.Training.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace EY.HRPlatform.Training.Infrastructure.Persistence;

public class TrainingDbContext : DbContext
{
    public TrainingDbContext(DbContextOptions<TrainingDbContext> options) : base(options) { }

    public DbSet<TrainingCategory> Categories => Set<TrainingCategory>();
    public DbSet<TrainingCourse> Trainings => Set<TrainingCourse>();
    public DbSet<TrainingChapter> Chapters => Set<TrainingChapter>();
    public DbSet<ContentBlock> ContentBlocks => Set<ContentBlock>();
    public DbSet<OnSiteCourse> OnSiteCourses => Set<OnSiteCourse>();
    public DbSet<ChapterProgress> ChapterProgress => Set<ChapterProgress>();
    public DbSet<ContentBlockProgress> ContentBlockProgress => Set<ContentBlockProgress>();
    public DbSet<Exam> Exams => Set<Exam>();
    public DbSet<ExamQuestion> ExamQuestions => Set<ExamQuestion>();
    public DbSet<ExamOption> ExamOptions => Set<ExamOption>();
    public DbSet<ExamAttempt> ExamAttempts => Set<ExamAttempt>();
    public DbSet<TrainingAssignment> Assignments => Set<TrainingAssignment>();
    public DbSet<TrainingProgress> TrainingProgress => Set<TrainingProgress>();
    public DbSet<Badge> Badges => Set<Badge>();
    public DbSet<EmployeeBadge> EmployeeBadges => Set<EmployeeBadge>();
    public DbSet<Certification> Certifications => Set<Certification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema("training");

        // --- UTC DateTime converters (same pattern as Identity) ---
        var dateTimeConverter = new ValueConverter<DateTime, DateTime>(
            v => v.ToUniversalTime(),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        var nullableDateTimeConverter = new ValueConverter<DateTime?, DateTime?>(
            v => v.HasValue ? v.Value.ToUniversalTime() : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime))
                    property.SetValueConverter(dateTimeConverter);
                else if (property.ClrType == typeof(DateTime?))
                    property.SetValueConverter(nullableDateTimeConverter);
            }
        }

        // --- TrainingCategory ---
        modelBuilder.Entity<TrainingCategory>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.Name).HasMaxLength(200).IsRequired();
            e.Property(c => c.Description).HasMaxLength(1000);
            e.HasIndex(c => c.Name).IsUnique();
        });

        // --- TrainingCourse ---
        modelBuilder.Entity<TrainingCourse>(e =>
        {
            e.HasKey(t => t.Id);
            e.Property(t => t.Title).HasMaxLength(300).IsRequired();
            e.Property(t => t.Description).HasMaxLength(2000);
            e.Property(t => t.Duration).HasMaxLength(50);
            e.Property(t => t.BadgeLevel).HasConversion<string>().HasMaxLength(20);
            e.Property(t => t.TrainingType).HasConversion<string>().HasMaxLength(20).HasDefaultValue(Domain.Enums.TrainingType.ELearning);
            e.HasQueryFilter(t => !t.IsDeleted);
            e.HasOne(t => t.Category)
                .WithMany(c => c.Trainings)
                .HasForeignKey(t => t.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(t => t.CategoryId);
        });

        // --- TrainingChapter ---
        modelBuilder.Entity<TrainingChapter>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.Title).HasMaxLength(300).IsRequired();
            e.Property(c => c.Layout).HasConversion<string>().HasMaxLength(30);
            e.HasOne(c => c.Training)
                .WithMany(t => t.Chapters)
                .HasForeignKey(c => c.TrainingId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(c => new { c.TrainingId, c.OrderIndex }).IsUnique();
        });

        // --- ContentBlock ---
        modelBuilder.Entity<ContentBlock>(e =>
        {
            e.HasKey(b => b.Id);
            e.Property(b => b.Title).HasMaxLength(300);
            e.Property(b => b.Type).HasConversion<string>().HasMaxLength(20);
            e.Property(b => b.ContentUri).HasMaxLength(500);
            e.Property(b => b.TextContent);
            e.Property(b => b.VideoUrl).HasMaxLength(500);
            e.Property(b => b.EstimatedDurationMinutes);
            e.HasOne(b => b.Chapter)
                .WithMany(c => c.ContentBlocks)
                .HasForeignKey(b => b.ChapterId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(b => new { b.ChapterId, b.OrderIndex }).IsUnique();
        });

        // --- OnSiteCourse ---
        modelBuilder.Entity<OnSiteCourse>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.Title).HasMaxLength(300).IsRequired();
            e.Property(c => c.ContentUri).HasMaxLength(500).IsRequired();
            e.HasOne(c => c.Training)
                .WithMany(t => t.OnSiteCourses)
                .HasForeignKey(c => c.TrainingId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(c => new { c.TrainingId, c.OrderIndex }).IsUnique();
        });
        // --- ChapterProgress ---
        modelBuilder.Entity<ChapterProgress>(e =>
        {
            e.HasKey(p => p.Id);
            e.HasOne(p => p.Chapter)
                .WithMany(c => c.ProgressRecords)
                .HasForeignKey(p => p.ChapterId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(p => new { p.EmployeeId, p.ChapterId }).IsUnique();
        });

        // --- ContentBlockProgress ---
        modelBuilder.Entity<ContentBlockProgress>(e =>
        {
            e.HasKey(p => p.Id);
            e.HasOne(p => p.ContentBlock)
                .WithMany(b => b.ProgressRecords)
                .HasForeignKey(p => p.ContentBlockId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(p => new { p.EmployeeId, p.ContentBlockId }).IsUnique();
        });

        // --- Exam ---
        modelBuilder.Entity<Exam>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(300).IsRequired();
            e.Property(x => x.Description).HasMaxLength(1000);
            e.HasOne(x => x.Training)
                .WithMany(t => t.Exams)
                .HasForeignKey(x => x.TrainingId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.TrainingId).IsUnique();
        });

        // --- ExamQuestion ---
        modelBuilder.Entity<ExamQuestion>(e =>
        {
            e.HasKey(q => q.Id);
            e.Property(q => q.QuestionText).HasMaxLength(1000).IsRequired();
            e.Property(q => q.Type).HasConversion<string>().HasMaxLength(30).IsRequired();
            e.HasOne(q => q.Exam)
                .WithMany(x => x.Questions)
                .HasForeignKey(q => q.ExamId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(q => new { q.ExamId, q.OrderIndex });
        });

        // --- ExamOption ---
        modelBuilder.Entity<ExamOption>(e =>
        {
            e.HasKey(o => o.Id);
            e.Property(o => o.OptionText).HasMaxLength(500).IsRequired();
            e.HasOne(o => o.Question)
                .WithMany(q => q.Options)
                .HasForeignKey(o => o.QuestionId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(o => new { o.QuestionId, o.OrderIndex });
        });

        // --- TrainingAssignment ---
        modelBuilder.Entity<TrainingAssignment>(e =>
        {
            e.HasKey(a => a.Id);
            e.Property(a => a.AssignmentType).HasConversion<string>().HasMaxLength(30);
            e.HasOne(a => a.Training)
                .WithMany(t => t.Assignments)
                .HasForeignKey(a => a.TrainingId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(a => new { a.TrainingId, a.EmployeeId }).IsUnique();
        });

        // --- ExamAttempt ---
        modelBuilder.Entity<ExamAttempt>(e =>
        {
            e.HasKey(a => a.Id);
            e.HasOne(a => a.Exam)
                .WithMany(x => x.Attempts)
                .HasForeignKey(a => a.ExamId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(a => a.Assignment)
                .WithMany()
                .HasForeignKey(a => a.AssignmentId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(a => new { a.EmployeeId, a.ExamId });
        });

        // --- TrainingProgress ---
        modelBuilder.Entity<TrainingProgress>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Status).HasConversion<string>().HasMaxLength(30);
            e.HasOne(p => p.Training)
                .WithMany(t => t.ProgressRecords)
                .HasForeignKey(p => p.TrainingId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(p => new { p.EmployeeId, p.TrainingId }).IsUnique();
        });

        // --- Badge ---
        modelBuilder.Entity<Badge>(e =>
        {
            e.HasKey(b => b.Id);
            e.Property(b => b.Name).HasMaxLength(200).IsRequired();
            e.Property(b => b.Level).HasConversion<string>().HasMaxLength(20);
            e.Property(b => b.Description).HasMaxLength(500);
            e.HasIndex(b => b.Name).IsUnique();
        });

        // --- EmployeeBadge ---
        modelBuilder.Entity<EmployeeBadge>(e =>
        {
            e.HasKey(eb => eb.Id);
            e.HasOne(eb => eb.Badge)
                .WithMany(b => b.EmployeeBadges)
                .HasForeignKey(eb => eb.BadgeId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(eb => new { eb.EmployeeId, eb.BadgeId }).IsUnique();
        });

        // --- Certification ---
        modelBuilder.Entity<Certification>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.CertificateUri).HasMaxLength(500);
            e.HasOne(c => c.Training)
                .WithMany()
                .HasForeignKey(c => c.TrainingId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(c => new { c.EmployeeId, c.TrainingId }).IsUnique();
        });
    }
}
