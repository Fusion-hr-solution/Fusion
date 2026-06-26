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
    public DbSet<TrainingPart> TrainingParts => Set<TrainingPart>();
    public DbSet<TrainingSession> TrainingSessions => Set<TrainingSession>();
    public DbSet<SessionEnrollment> SessionEnrollments => Set<SessionEnrollment>();
    public DbSet<SessionAttendanceToken> SessionAttendanceTokens => Set<SessionAttendanceToken>();
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
    public DbSet<TrainingFeedback> TrainingFeedbacks => Set<TrainingFeedback>();
    public DbSet<FeedbackQuestion> FeedbackQuestions => Set<FeedbackQuestion>();
    public DbSet<FeedbackAnswer> FeedbackAnswers => Set<FeedbackAnswer>();
    public DbSet<TrainerGroupFeedback> TrainerGroupFeedbacks => Set<TrainerGroupFeedback>();
    public DbSet<Grade> Grades => Set<Grade>();
    public DbSet<ServiceLine> ServiceLines => Set<ServiceLine>();
    public DbSet<CurriculumMapping> CurriculumMappings => Set<CurriculumMapping>();
    public DbSet<EmployeeProfile> EmployeeProfiles => Set<EmployeeProfile>();
    public DbSet<TrainingImportSession> TrainingImportSessions => Set<TrainingImportSession>();
    public DbSet<TrainingImportHistory> TrainingImportHistories => Set<TrainingImportHistory>();
    public DbSet<QuizDraft> QuizDrafts => Set<QuizDraft>();

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
            e.Property(t => t.IssuesCertificate).HasDefaultValue(true);
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
        // --- TrainingPart ---
        modelBuilder.Entity<TrainingPart>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Title).HasMaxLength(300).IsRequired();
            e.Property(p => p.Description).HasMaxLength(2000);
            e.Property(p => p.DurationHours).HasPrecision(5, 2);
            e.HasOne(p => p.Training)
                .WithMany(t => t.Parts)
                .HasForeignKey(p => p.TrainingId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(p => new { p.TrainingId, p.OrderIndex }).IsUnique();
        });

        // --- TrainingSession ---
        modelBuilder.Entity<TrainingSession>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.Room).HasMaxLength(200).IsRequired();
            e.Property(s => s.Notes).HasMaxLength(2000);
            e.Property(s => s.TrainerName).HasMaxLength(200);
            e.Property(s => s.TrainerEmail).HasMaxLength(320);
            e.Property(s => s.CancelReason).HasMaxLength(1000);
            e.Property(s => s.Status).HasConversion<string>().HasMaxLength(20);
            e.HasOne(s => s.Part)
                .WithMany(p => p.Sessions)
                .HasForeignKey(s => s.PartId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(s => new { s.PartId, s.StartUtc });
            e.HasIndex(s => new { s.Room, s.StartUtc });
            e.HasIndex(s => s.TrainerEmployeeId);
        });

        // --- SessionEnrollment ---
        modelBuilder.Entity<SessionEnrollment>(e =>
        {
            e.HasKey(se => se.Id);
            e.Property(se => se.Status).HasConversion<string>().HasMaxLength(20);
            e.HasOne(se => se.Session)
                .WithMany()
                .HasForeignKey(se => se.SessionId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(se => new { se.EmployeeId, se.SessionId }).IsUnique()
                .HasFilter("\"Status\" != 'Cancelled'");
            e.HasIndex(se => se.SessionId);
            e.HasIndex(se => se.EmployeeId);
        });

        // --- SessionAttendanceToken ---
        modelBuilder.Entity<SessionAttendanceToken>(e =>
        {
            e.HasKey(t => t.Id);
            e.Property(t => t.Secret).HasMaxLength(128).IsRequired();
            e.HasOne(t => t.Session)
                .WithMany()
                .HasForeignKey(t => t.SessionId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(t => t.SessionId).IsUnique();
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
            e.HasIndex(q => new { q.ExamId, q.OrderIndex }).IsUnique();
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
            e.HasIndex(o => new { o.QuestionId, o.OrderIndex }).IsUnique();
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
            e.Property(c => c.CertificateNumber).HasMaxLength(40).IsRequired();
            e.Property(c => c.EmployeeFullName).HasMaxLength(256).IsRequired();
            e.Property(c => c.GradeName).HasMaxLength(100);
            e.Property(c => c.ServiceLineName).HasMaxLength(100);
            e.Property(c => c.TrainingTitle).HasMaxLength(300).IsRequired();
            e.Property(c => c.TrainingDescription).HasMaxLength(2000);
            e.Property(c => c.Duration).HasMaxLength(50);
            e.Property(c => c.TrainerName).HasMaxLength(200);
            e.Property(c => c.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(c => c.RevokedReason).HasMaxLength(1000);
            e.Property(c => c.RevokedBy).HasMaxLength(256);
            e.Property(c => c.PdfContentType).HasMaxLength(100);

            // No FK on TrainingId/EmployeeId/GradeId/ServiceLineId — soft references; the
            // certificate is an immutable snapshot that must survive deletion of what it references.
            e.HasIndex(c => c.CertificateNumber).IsUnique();
            // At most one ACTIVE certificate per (employee, formation); revoked rows are excluded
            // so a re-completed formation can issue a fresh certificate.
            e.HasIndex(c => new { c.EmployeeId, c.TrainingId })
                .IsUnique()
                .HasFilter("\"Status\" = 'Valid'");
            e.HasIndex(c => c.TrainingId);
            e.HasIndex(c => c.Status);
            e.HasIndex(c => c.IssuedAt);
        });

        // --- Grade ---
        modelBuilder.Entity<Grade>(e =>
        {
            e.HasKey(g => g.Id);
            e.Property(g => g.Name).HasMaxLength(100).IsRequired();
            e.Property(g => g.Description).HasMaxLength(500);
            e.Property(g => g.Icon).HasMaxLength(50);
            e.HasIndex(g => g.Name).IsUnique();
            e.HasIndex(g => g.Level).IsUnique();
        });

        // --- ServiceLine ---
        modelBuilder.Entity<ServiceLine>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.Name).HasMaxLength(100).IsRequired();
            e.Property(s => s.Code).HasMaxLength(20).IsRequired();
            e.Property(s => s.Description).HasMaxLength(500);
            e.Property(s => s.Color).HasMaxLength(20).IsRequired();
            e.HasIndex(s => s.Name).IsUnique();
            e.HasIndex(s => s.Code).IsUnique();
        });

        // --- CurriculumMapping ---
        modelBuilder.Entity<CurriculumMapping>(e =>
        {
            e.HasKey(m => m.Id);
            e.HasOne(m => m.Grade)
                .WithMany()
                .HasForeignKey(m => m.GradeId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(m => m.ServiceLine)
                .WithMany()
                .HasForeignKey(m => m.ServiceLineId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(m => m.Training)
                .WithMany()
                .HasForeignKey(m => m.TrainingId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(m => new { m.GradeId, m.ServiceLineId, m.TrainingId }).IsUnique();
            e.HasIndex(m => new { m.GradeId, m.ServiceLineId, m.OrderIndex }).IsUnique();
        });

        // --- EmployeeProfile ---
        modelBuilder.Entity<EmployeeProfile>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.FullName).HasMaxLength(256);
            e.Property(p => p.Email).HasMaxLength(320);
            e.HasOne(p => p.Grade)
                .WithMany()
                .HasForeignKey(p => p.GradeId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(p => p.ServiceLine)
                .WithMany()
                .HasForeignKey(p => p.ServiceLineId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(p => p.EmployeeId).IsUnique();
        });

        // --- TrainingFeedback (one per employee × training; immutable — ADR 0006) ---
        modelBuilder.Entity<TrainingFeedback>(e =>
        {
            e.HasKey(f => f.Id);
            e.Property(f => f.Comment).HasMaxLength(2000);
            e.Property(f => f.Suggestions).HasMaxLength(2000);
            e.HasOne(f => f.Training)
                .WithMany()
                .HasForeignKey(f => f.TrainingId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(f => new { f.EmployeeId, f.TrainingId }).IsUnique();
            e.HasIndex(f => f.TrainingId);
            e.HasIndex(f => f.SubmittedAt);
        });

        // --- FeedbackQuestion (custom form, append-only — ADR 0006) ---
        // CategoryId is a soft reference (no FK): a question outlives category changes; null = default form.
        modelBuilder.Entity<FeedbackQuestion>(e =>
        {
            e.HasKey(q => q.Id);
            e.Property(q => q.Type).HasConversion<string>().HasMaxLength(30);
            e.Property(q => q.Label).HasMaxLength(500).IsRequired();
            e.Property(q => q.Options).HasMaxLength(2000);
            e.HasIndex(q => new { q.CategoryId, q.Order });
        });

        // --- FeedbackAnswer (snapshots question label/type at submit time) ---
        modelBuilder.Entity<FeedbackAnswer>(e =>
        {
            e.HasKey(a => a.Id);
            e.Property(a => a.QuestionLabelSnapshot).HasMaxLength(500).IsRequired();
            e.Property(a => a.QuestionTypeSnapshot).HasMaxLength(30).IsRequired();
            e.Property(a => a.Value).HasMaxLength(2000).IsRequired();
            e.HasOne(a => a.Feedback)
                .WithMany(f => f.Answers)
                .HasForeignKey(a => a.FeedbackId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne<FeedbackQuestion>()
                .WithMany()
                .HasForeignKey(a => a.QuestionId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(a => a.FeedbackId);
            e.HasIndex(a => a.QuestionId);
        });

        // --- TrainerGroupFeedback (one per session × trainer; admin-only) ---
        modelBuilder.Entity<TrainerGroupFeedback>(e =>
        {
            e.HasKey(t => t.Id);
            e.Property(t => t.Comments).HasMaxLength(2000);
            e.Property(t => t.PrerequisiteSuggestions).HasMaxLength(2000);
            e.HasOne(t => t.Session)
                .WithMany()
                .HasForeignKey(t => t.SessionId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(t => new { t.SessionId, t.TrainerEmployeeId }).IsUnique();
            e.HasIndex(t => t.TrainerEmployeeId);
        });

        // --- TrainingImportSession (US-8.2.3 staged import preview, ADR 0008) ---
        modelBuilder.Entity<TrainingImportSession>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.FileName).HasMaxLength(260);
            e.Property(s => s.PayloadJson).HasColumnType("jsonb");
            e.HasIndex(s => s.CreatedByEmployeeId);
        });

        // --- TrainingImportHistory (US-8.2.3 applied-import audit log, ADR 0008) ---
        modelBuilder.Entity<TrainingImportHistory>(e =>
        {
            e.HasKey(h => h.Id);
            e.Property(h => h.FileName).HasMaxLength(260);
            e.HasIndex(h => h.CreatedByEmployeeId);
        });

        // --- QuizDraft (US-8.2.5 per-training AI quiz draft, ADR 0009) ---
        modelBuilder.Entity<QuizDraft>(e =>
        {
            e.HasKey(d => d.Id);
            e.Property(d => d.QuestionsJson).HasColumnType("jsonb");
            e.HasIndex(d => d.TrainingId).IsUnique();
        });
    }
}
