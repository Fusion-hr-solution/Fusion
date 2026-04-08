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
    public DbSet<ChapterProgress> ChapterProgress => Set<ChapterProgress>();
    public DbSet<Exam> Exams => Set<Exam>();
    public DbSet<ExamQuestion> ExamQuestions => Set<ExamQuestion>();
    public DbSet<ExamOption> ExamOptions => Set<ExamOption>();
    public DbSet<ExamAttempt> ExamAttempts => Set<ExamAttempt>();
    public DbSet<TrainingAssignment> Assignments => Set<TrainingAssignment>();
    public DbSet<TrainingProgress> TrainingProgress => Set<TrainingProgress>();
    public DbSet<Badge> Badges => Set<Badge>();
    public DbSet<EmployeeBadge> EmployeeBadges => Set<EmployeeBadge>();
    public DbSet<Certification> Certifications => Set<Certification>();
    public DbSet<ArticleTemplate> ArticleTemplates => Set<ArticleTemplate>();
    public DbSet<ArticleTemplateSection> ArticleTemplateSections => Set<ArticleTemplateSection>();

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
            e.Property(c => c.ContentType).HasConversion<string>().HasMaxLength(20);
            e.Property(c => c.ContentUri).HasMaxLength(500);
            e.Property(c => c.TextContent);
            e.Property(c => c.VideoUrl).HasMaxLength(500);
            e.Property(c => c.EstimatedDurationMinutes);
            e.HasOne(c => c.Training)
                .WithMany(t => t.Chapters)
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

        // --- Exam ---
        modelBuilder.Entity<Exam>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(300).IsRequired();
            e.HasOne(x => x.Training)
                .WithMany(t => t.Exams)
                .HasForeignKey(x => x.TrainingId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // --- ExamQuestion ---
        modelBuilder.Entity<ExamQuestion>(e =>
        {
            e.HasKey(q => q.Id);
            e.Property(q => q.QuestionText).HasMaxLength(1000).IsRequired();
            e.Property(q => q.Type).HasMaxLength(50).IsRequired();
            e.HasOne(q => q.Exam)
                .WithMany(x => x.Questions)
                .HasForeignKey(q => q.ExamId)
                .OnDelete(DeleteBehavior.Cascade);
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

        // --- ArticleTemplate ---
        modelBuilder.Entity<ArticleTemplate>(e =>
        {
            e.HasKey(t => t.Id);
            e.Property(t => t.Name).HasMaxLength(200).IsRequired();
            e.Property(t => t.Description).HasMaxLength(500);
            e.HasIndex(t => t.Name).IsUnique();
        });

        // --- ArticleTemplateSection ---
        modelBuilder.Entity<ArticleTemplateSection>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.Label).HasMaxLength(200).IsRequired();
            e.Property(s => s.Placeholder).HasMaxLength(500);
            e.HasOne(s => s.Template)
                .WithMany(t => t.Sections)
                .HasForeignKey(s => s.TemplateId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(s => new { s.TemplateId, s.OrderIndex }).IsUnique();
        });
    }
}
