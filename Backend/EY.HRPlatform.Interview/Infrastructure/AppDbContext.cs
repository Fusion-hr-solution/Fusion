using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Infrastructure;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<CandidateInvitation> CandidateInvitations => Set<CandidateInvitation>();
    public DbSet<CandidateAttemptSettings> CandidateAttemptSettings => Set<CandidateAttemptSettings>();
    public DbSet<CandidateLinkSecuritySettings> CandidateLinkSecuritySettings => Set<CandidateLinkSecuritySettings>();
    public DbSet<CandidateProgressEvent> CandidateProgressEvents => Set<CandidateProgressEvent>();
    public DbSet<CandidatePrivacyAction> CandidatePrivacyActions => Set<CandidatePrivacyAction>();
    public DbSet<CandidateRetentionSettings> CandidateRetentionSettings => Set<CandidateRetentionSettings>();
    public DbSet<CandidateRetentionRun> CandidateRetentionRuns => Set<CandidateRetentionRun>();
    public DbSet<CandidateTestAttempt> CandidateTestAttempts => Set<CandidateTestAttempt>();
    public DbSet<GradingJob> GradingJobs => Set<GradingJob>();
    public DbSet<QuestionGradeResult> QuestionGradeResults => Set<QuestionGradeResult>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<QuestionOption> QuestionOptions => Set<QuestionOption>();
    public DbSet<Test> Tests => Set<Test>();
    public DbSet<TestQuestion> TestQuestions => Set<TestQuestion>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly,
            type => type.Namespace == "EY.HRPlatform.Interview.Infrastructure.Configurations");
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var utcNow = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<Question>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Property(x => x.CreatedAt).CurrentValue = utcNow;
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
                entry.Property(x => x.CreatedAt).IsModified = false;
            }
        }

        foreach (var entry in ChangeTracker.Entries<Test>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Property(x => x.CreatedAt).CurrentValue = utcNow;
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
                entry.Property(x => x.CreatedAt).IsModified = false;
            }
        }

        foreach (var entry in ChangeTracker.Entries<CandidateInvitation>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Property(x => x.CreatedAt).CurrentValue = utcNow;
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
                entry.Property(x => x.CreatedAt).IsModified = false;
            }
        }

        foreach (var entry in ChangeTracker.Entries<CandidateAttemptSettings>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Property(x => x.CreatedAt).CurrentValue = utcNow;
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
                entry.Property(x => x.CreatedAt).IsModified = false;
            }
        }

        foreach (var entry in ChangeTracker.Entries<CandidateLinkSecuritySettings>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Property(x => x.CreatedAt).CurrentValue = utcNow;
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
                entry.Property(x => x.CreatedAt).IsModified = false;
            }
        }

        foreach (var entry in ChangeTracker.Entries<CandidateTestAttempt>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Property(x => x.CreatedAt).CurrentValue = utcNow;
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
                entry.Property(x => x.CreatedAt).IsModified = false;
            }
        }

        foreach (var entry in ChangeTracker.Entries<CandidateProgressEvent>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Property(x => x.CreatedAt).CurrentValue = utcNow;
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
                entry.Property(x => x.CreatedAt).IsModified = false;
            }
        }

        foreach (var entry in ChangeTracker.Entries<CandidatePrivacyAction>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Property(x => x.CreatedAt).CurrentValue = utcNow;
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
                entry.Property(x => x.CreatedAt).IsModified = false;
            }
        }

        foreach (var entry in ChangeTracker.Entries<CandidateRetentionSettings>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Property(x => x.CreatedAt).CurrentValue = utcNow;
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
                entry.Property(x => x.CreatedAt).IsModified = false;
            }
        }

        foreach (var entry in ChangeTracker.Entries<CandidateRetentionRun>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Property(x => x.CreatedAt).CurrentValue = utcNow;
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Property(x => x.UpdatedAt).CurrentValue = utcNow;
                entry.Property(x => x.CreatedAt).IsModified = false;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}