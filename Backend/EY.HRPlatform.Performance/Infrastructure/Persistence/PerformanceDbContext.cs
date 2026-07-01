using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence;

public class PerformanceDbContext : DbContext
{
    private readonly ITenantContext? _tenantContext;

    /// <summary>Runtime constructor with tenant context for production use.</summary>
    public PerformanceDbContext(DbContextOptions<PerformanceDbContext> options, ITenantContext tenantContext)
        : base(options)
    {
        _tenantContext = tenantContext;
    }

    /// <summary>Design-time constructor for EF migrations tooling.</summary>
    public PerformanceDbContext(DbContextOptions<PerformanceDbContext> options)
        : base(options)
    {
        _tenantContext = null;
    }

    /// <summary>
    /// Current tenant ID used for query filters. Returns Empty when no tenant resolved
    /// (design-time or unauthenticated), resulting in fail-closed query behavior.
    /// </summary>
    private Guid CurrentTenantId => _tenantContext?.TenantIdOrDefault ?? Guid.Empty;

    public DbSet<PerformanceCycle> PerformanceCycles => Set<PerformanceCycle>();
    public DbSet<PerformanceCyclePopulationRule> PerformanceCyclePopulationRules => Set<PerformanceCyclePopulationRule>();
    public DbSet<PerformanceCycleParticipant> PerformanceCycleParticipants => Set<PerformanceCycleParticipant>();
    public DbSet<CampaignLaunchParticipantSnapshot> CampaignLaunchParticipantSnapshots => Set<CampaignLaunchParticipantSnapshot>();
    public DbSet<CampaignExceptionOwner> CampaignExceptionOwners => Set<CampaignExceptionOwner>();
    public DbSet<ExceptionCase> ExceptionCases => Set<ExceptionCase>();
    public DbSet<ExceptionCaseHistoryEntry> ExceptionCaseHistoryEntries => Set<ExceptionCaseHistoryEntry>();
    public DbSet<FormalReviewDefinitionSnapshot> FormalReviewDefinitionSnapshots => Set<FormalReviewDefinitionSnapshot>();
    public DbSet<FormalReviewCriterionSnapshot> FormalReviewCriterionSnapshots => Set<FormalReviewCriterionSnapshot>();
    public DbSet<FormalRatingScaleLevelSnapshot> FormalRatingScaleLevelSnapshots => Set<FormalRatingScaleLevelSnapshot>();
    public DbSet<PerformanceReview> PerformanceReviews => Set<PerformanceReview>();
    public DbSet<PerformanceReviewCriterionResponse> PerformanceReviewCriterionResponses => Set<PerformanceReviewCriterionResponse>();
    public DbSet<PerformanceObjective> PerformanceObjectives => Set<PerformanceObjective>();
    public DbSet<PerformanceObjectiveMilestone> PerformanceObjectiveMilestones => Set<PerformanceObjectiveMilestone>();
    public DbSet<CampaignWorkItem> CampaignWorkItems => Set<CampaignWorkItem>();
    public DbSet<CampaignAssignmentResponsibility> CampaignAssignmentResponsibilities => Set<CampaignAssignmentResponsibility>();
    public DbSet<ObjectiveTemplate> ObjectiveTemplates => Set<ObjectiveTemplate>();
    public DbSet<PerformanceNotification> PerformanceNotifications => Set<PerformanceNotification>();
    public DbSet<PerformanceCycleAuditEvent> PerformanceCycleAuditEvents => Set<PerformanceCycleAuditEvent>();

    // Strategic objective + phase shared entities (Plan 03-02)
    public DbSet<StrategicPeriod> StrategicPeriods => Set<StrategicPeriod>();
    public DbSet<StrategicObjective> StrategicObjectives => Set<StrategicObjective>();
    public DbSet<ObjectiveProgressEntry> ObjectiveProgressEntries => Set<ObjectiveProgressEntry>();
    public DbSet<ApprovalDelegate> ApprovalDelegates => Set<ApprovalDelegate>();

    // Feedback response model entities (Plan 04-01)
    public DbSet<FeedbackTemplateSnapshot> FeedbackTemplateSnapshots => Set<FeedbackTemplateSnapshot>();
    public DbSet<FeedbackPromptSnapshot> FeedbackPromptSnapshots => Set<FeedbackPromptSnapshot>();
    public DbSet<FeedbackResponseContent> FeedbackResponseContents => Set<FeedbackResponseContent>();
    public DbSet<FeedbackResponseVersion> FeedbackResponseVersions => Set<FeedbackResponseVersion>();
    public DbSet<FeedbackIdentityMapping> FeedbackIdentityMappings => Set<FeedbackIdentityMapping>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>()
            .HaveConversion<UtcDateTimeConverter>();

        configurationBuilder.Properties<DateTime?>()
            .HaveConversion<UtcNullableDateTimeConverter>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasDefaultSchema("performance");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PerformanceDbContext).Assembly);

        // Global tenant filters: all queries automatically scoped to the current tenant.
        // When CurrentTenantId is Empty (design-time/no context), queries return no results.
        modelBuilder.Entity<PerformanceCycle>()
            .HasQueryFilter(c => CurrentTenantId != Guid.Empty && c.TenantId == CurrentTenantId);

        modelBuilder.Entity<PerformanceCyclePopulationRule>()
            .HasQueryFilter(r => CurrentTenantId != Guid.Empty && r.TenantId == CurrentTenantId);

        modelBuilder.Entity<PerformanceCycleParticipant>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<CampaignLaunchParticipantSnapshot>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<CampaignExceptionOwner>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<ExceptionCase>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<ExceptionCaseHistoryEntry>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<FormalReviewDefinitionSnapshot>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<FormalReviewCriterionSnapshot>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<FormalRatingScaleLevelSnapshot>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<PerformanceReview>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<PerformanceReviewCriterionResponse>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<PerformanceObjective>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);

        modelBuilder.Entity<PerformanceObjectiveMilestone>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);

        modelBuilder.Entity<CampaignWorkItem>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);

        modelBuilder.Entity<CampaignAssignmentResponsibility>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);

        modelBuilder.Entity<ObjectiveTemplate>()
            .HasQueryFilter(t => CurrentTenantId != Guid.Empty && t.TenantId == CurrentTenantId);

        modelBuilder.Entity<PerformanceNotification>()
            .HasQueryFilter(n => CurrentTenantId != Guid.Empty && n.TenantId == CurrentTenantId);

        modelBuilder.Entity<PerformanceCycleAuditEvent>()
            .HasQueryFilter(a => CurrentTenantId != Guid.Empty && a.TenantId == CurrentTenantId);

        // Strategic + phase shared entity tenant filters (Plan 03-02)
        modelBuilder.Entity<StrategicPeriod>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<StrategicObjective>()
            .HasQueryFilter(o => CurrentTenantId != Guid.Empty && o.TenantId == CurrentTenantId);

        modelBuilder.Entity<ObjectiveProgressEntry>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);

        modelBuilder.Entity<ApprovalDelegate>()
            .HasQueryFilter(d => CurrentTenantId != Guid.Empty && d.TenantId == CurrentTenantId);

        // Feedback response model tenant filters (Plan 04-01)
        modelBuilder.Entity<FeedbackTemplateSnapshot>()
            .HasQueryFilter(t => CurrentTenantId != Guid.Empty && t.TenantId == CurrentTenantId);

        modelBuilder.Entity<FeedbackPromptSnapshot>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<FeedbackResponseContent>()
            .HasQueryFilter(r => CurrentTenantId != Guid.Empty && r.TenantId == CurrentTenantId);

        modelBuilder.Entity<FeedbackResponseVersion>()
            .HasQueryFilter(v => CurrentTenantId != Guid.Empty && v.TenantId == CurrentTenantId);

        modelBuilder.Entity<FeedbackIdentityMapping>()
            .HasQueryFilter(m => CurrentTenantId != Guid.Empty && m.TenantId == CurrentTenantId);
    }
}
