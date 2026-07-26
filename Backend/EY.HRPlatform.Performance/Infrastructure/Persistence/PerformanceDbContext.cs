using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Domain.Entities.Skills;
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
    public DbSet<PerformanceCycleApproverOverride> PerformanceCycleApproverOverrides => Set<PerformanceCycleApproverOverride>();
    public DbSet<PerformanceCycleParticipantExclusion> PerformanceCycleParticipantExclusions => Set<PerformanceCycleParticipantExclusion>();
    public DbSet<PerformanceCycleApproverReassignment> PerformanceCycleApproverReassignments => Set<PerformanceCycleApproverReassignment>();
    public DbSet<PerformancePlanningReminder> PerformancePlanningReminders => Set<PerformancePlanningReminder>();
    public DbSet<CampaignStrategicObjective> CampaignStrategicObjectives => Set<CampaignStrategicObjective>();
    public DbSet<CampaignTeamObjective> CampaignTeamObjectives => Set<CampaignTeamObjective>();
    public DbSet<EmployeeObjectivePlan> EmployeeObjectivePlans => Set<EmployeeObjectivePlan>();
    public DbSet<PerformanceNotification> PerformanceNotifications => Set<PerformanceNotification>();
    public DbSet<PerformanceCycleAuditEvent> PerformanceCycleAuditEvents => Set<PerformanceCycleAuditEvent>();
    public DbSet<PerformanceConfigurationAuditEntry> PerformanceConfigurationAuditEntries => Set<PerformanceConfigurationAuditEntry>();
    public DbSet<ActivityLogEntry> ActivityLogEntries => Set<ActivityLogEntry>();
    public DbSet<ObjectiveProgressUpdate> ObjectiveProgressUpdates => Set<ObjectiveProgressUpdate>();
    public DbSet<PerformanceCheckIn> PerformanceCheckIns => Set<PerformanceCheckIn>();
    public DbSet<CheckInFollowUpAction> CheckInFollowUpActions => Set<CheckInFollowUpAction>();
    public DbSet<ObjectiveDiscussionSignal> ObjectiveDiscussionSignals => Set<ObjectiveDiscussionSignal>();
    public DbSet<ScheduledJobRun> ScheduledJobRuns => Set<ScheduledJobRun>();
    public DbSet<Attachment> Attachments => Set<Attachment>();

    // Evaluation configuration, rounds, immutable launch snapshots, and assignments
    public DbSet<EvaluationRatingScale> EvaluationRatingScales => Set<EvaluationRatingScale>();
    public DbSet<EvaluationRatingScaleLevel> EvaluationRatingScaleLevels => Set<EvaluationRatingScaleLevel>();
    public DbSet<EvaluationTemplate> EvaluationTemplates => Set<EvaluationTemplate>();
    public DbSet<EvaluationTemplateSection> EvaluationTemplateSections => Set<EvaluationTemplateSection>();
    public DbSet<EvaluationTemplateQuestion> EvaluationTemplateQuestions => Set<EvaluationTemplateQuestion>();
    public DbSet<EvaluationRound> EvaluationRounds => Set<EvaluationRound>();
    public DbSet<EvaluationRoundScaleDraftLevel> EvaluationRoundScaleDraftLevels => Set<EvaluationRoundScaleDraftLevel>();
    public DbSet<EvaluationRoundTemplateDraftSection> EvaluationRoundTemplateDraftSections => Set<EvaluationRoundTemplateDraftSection>();
    public DbSet<EvaluationRoundTemplateDraftQuestion> EvaluationRoundTemplateDraftQuestions => Set<EvaluationRoundTemplateDraftQuestion>();
    public DbSet<EvaluationRoundExclusion> EvaluationRoundExclusions => Set<EvaluationRoundExclusion>();
    public DbSet<EvaluationRoundReviewerCorrection> EvaluationRoundReviewerCorrections => Set<EvaluationRoundReviewerCorrection>();
    public DbSet<EvaluationRoundScaleSnapshot> EvaluationRoundScaleSnapshots => Set<EvaluationRoundScaleSnapshot>();
    public DbSet<EvaluationRoundScaleSnapshotLevel> EvaluationRoundScaleSnapshotLevels => Set<EvaluationRoundScaleSnapshotLevel>();
    public DbSet<EvaluationRoundTemplateSnapshot> EvaluationRoundTemplateSnapshots => Set<EvaluationRoundTemplateSnapshot>();
    public DbSet<EvaluationRoundTemplateSnapshotSection> EvaluationRoundTemplateSnapshotSections => Set<EvaluationRoundTemplateSnapshotSection>();
    public DbSet<EvaluationRoundTemplateSnapshotQuestion> EvaluationRoundTemplateSnapshotQuestions => Set<EvaluationRoundTemplateSnapshotQuestion>();
    public DbSet<EvaluationRoundPolicySnapshot> EvaluationRoundPolicySnapshots => Set<EvaluationRoundPolicySnapshot>();
    public DbSet<EvaluationRoundParticipant> EvaluationRoundParticipants => Set<EvaluationRoundParticipant>();
    public DbSet<EvaluationObjectivePlanSnapshot> EvaluationObjectivePlanSnapshots => Set<EvaluationObjectivePlanSnapshot>();
    public DbSet<EvaluationObjectiveSnapshot> EvaluationObjectiveSnapshots => Set<EvaluationObjectiveSnapshot>();
    public DbSet<EvaluationRoundDeadlineExtension> EvaluationRoundDeadlineExtensions => Set<EvaluationRoundDeadlineExtension>();
    public DbSet<EvaluationAssignment> EvaluationAssignments => Set<EvaluationAssignment>();
    public DbSet<EvaluationRoundSkillDraftItem> EvaluationRoundSkillDraftItems => Set<EvaluationRoundSkillDraftItem>();
    public DbSet<EvaluationRoundProficiencyDraftLevel> EvaluationRoundProficiencyDraftLevels => Set<EvaluationRoundProficiencyDraftLevel>();
    public DbSet<EvaluationRoundSkillSnapshot> EvaluationRoundSkillSnapshots => Set<EvaluationRoundSkillSnapshot>();
    public DbSet<EvaluationRoundSkillSnapshotLevel> EvaluationRoundSkillSnapshotLevels => Set<EvaluationRoundSkillSnapshotLevel>();
    public DbSet<EvaluationRoundSkillSnapshotItem> EvaluationRoundSkillSnapshotItems => Set<EvaluationRoundSkillSnapshotItem>();
    public DbSet<EvaluationObjectiveRating> EvaluationObjectiveRatings => Set<EvaluationObjectiveRating>();
    public DbSet<EvaluationSkillRating> EvaluationSkillRatings => Set<EvaluationSkillRating>();
    public DbSet<EvaluationQuestionAnswer> EvaluationQuestionAnswers => Set<EvaluationQuestionAnswer>();

    // Skills configuration domain (categories, skills, proficiency scales, expectation sets)
    public DbSet<SkillCategory> SkillCategories => Set<SkillCategory>();
    public DbSet<Skill> Skills => Set<Skill>();
    public DbSet<ProficiencyScale> ProficiencyScales => Set<ProficiencyScale>();
    public DbSet<ProficiencyScaleLevel> ProficiencyScaleLevels => Set<ProficiencyScaleLevel>();
    public DbSet<SkillExpectationSet> SkillExpectationSets => Set<SkillExpectationSet>();
    public DbSet<SkillExpectationItem> SkillExpectationItems => Set<SkillExpectationItem>();

    // Platform-scoped entities (D1: no tenant filter, no ITenantEntity, PlatformAdmin gated)
    public DbSet<PlatformPerformanceGuardrails> PlatformPerformanceGuardrails => Set<PlatformPerformanceGuardrails>();
    public DbSet<PlatformObjectiveBaseline> PlatformObjectiveBaselines => Set<PlatformObjectiveBaseline>();
    public DbSet<PlatformObjectiveBaselineVersion> PlatformObjectiveBaselineVersions => Set<PlatformObjectiveBaselineVersion>();


    // Tenant objective policy
    public DbSet<TenantObjectivePolicy> TenantObjectivePolicies => Set<TenantObjectivePolicy>();
    public DbSet<TenantObjectivePolicyVersion> TenantObjectivePolicyVersions => Set<TenantObjectivePolicyVersion>();

    // Strategic objective + phase shared entities (Plan 03-02)
    public DbSet<StrategicPeriod> StrategicPeriods => Set<StrategicPeriod>();
    public DbSet<StrategicObjective> StrategicObjectives => Set<StrategicObjective>();
    public DbSet<ApprovalDelegate> ApprovalDelegates => Set<ApprovalDelegate>();


    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        RejectAuditEntryMutations();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        RejectAuditEntryMutations();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    /// <summary>
    /// Configuration lifecycle records are append-only (P1.1 §15): any tracked update or delete
    /// of an existing entry is rejected before it reaches the database.
    /// </summary>
    private void RejectAuditEntryMutations()
    {
        var mutated = ChangeTracker.Entries<PerformanceConfigurationAuditEntry>()
            .Any(e => e.State is EntityState.Modified or EntityState.Deleted);

        if (mutated)
            throw new InvalidOperationException(
                "Configuration audit entries are append-only and cannot be modified or deleted.");

        var activityMutated = ChangeTracker.Entries<ActivityLogEntry>()
            .Any(e => e.State is EntityState.Modified or EntityState.Deleted);

        if (activityMutated)
            throw new InvalidOperationException(
                "Activity-log entries are append-only and cannot be modified or deleted.");

        var progressMutated = ChangeTracker.Entries<ObjectiveProgressUpdate>()
            .Any(e => e.State is EntityState.Modified or EntityState.Deleted);

        if (progressMutated)
            throw new InvalidOperationException(
                "Objective progress updates are append-only and cannot be modified or deleted.");

        var addendumMutated = ChangeTracker.Entries<PerformanceCheckInAddendum>()
            .Any(e => e.State is EntityState.Modified or EntityState.Deleted);

        if (addendumMutated)
            throw new InvalidOperationException(
                "Check-in addenda are append-only and cannot be modified or deleted.");

        var responseMutated = ChangeTracker.Entries<PerformanceCheckInResponse>()
            .Any(e => e.State is EntityState.Modified or EntityState.Deleted);

        if (responseMutated)
            throw new InvalidOperationException(
                "Check-in employee responses are immutable and cannot be modified or deleted.");

        var rescheduleMutated = ChangeTracker.Entries<PerformanceCheckInRescheduleEntry>()
            .Any(e => e.State is EntityState.Modified or EntityState.Deleted);

        if (rescheduleMutated)
            throw new InvalidOperationException(
                "Check-in reschedule entries are append-only and cannot be modified or deleted.");

        var actionStatusMutated = ChangeTracker.Entries<CheckInFollowUpActionStatusEvent>()
            .Any(e => e.State is EntityState.Modified or EntityState.Deleted);

        if (actionStatusMutated)
            throw new InvalidOperationException(
                "Follow-up action status events are append-only and cannot be modified or deleted.");
    }

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

        modelBuilder.Entity<PerformanceCycleApproverOverride>()
            .HasQueryFilter(o => CurrentTenantId != Guid.Empty && o.TenantId == CurrentTenantId);

        modelBuilder.Entity<PerformanceCycleParticipantExclusion>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);

        modelBuilder.Entity<PerformanceCycleApproverReassignment>()
            .HasQueryFilter(r => CurrentTenantId != Guid.Empty && r.TenantId == CurrentTenantId);

        modelBuilder.Entity<PerformancePlanningReminder>()
            .HasQueryFilter(r => CurrentTenantId != Guid.Empty && r.TenantId == CurrentTenantId);

        modelBuilder.Entity<CampaignStrategicObjective>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<CampaignTeamObjective>()
            .HasQueryFilter(t => CurrentTenantId != Guid.Empty && t.TenantId == CurrentTenantId);

        modelBuilder.Entity<EmployeeObjectivePlan>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<PerformanceNotification>()
            .HasQueryFilter(n => CurrentTenantId != Guid.Empty && n.TenantId == CurrentTenantId);

        modelBuilder.Entity<PerformanceCycleAuditEvent>()
            .HasQueryFilter(a => CurrentTenantId != Guid.Empty && a.TenantId == CurrentTenantId);

        modelBuilder.Entity<ActivityLogEntry>()
            .HasQueryFilter(a => CurrentTenantId != Guid.Empty && a.TenantId == CurrentTenantId);

        modelBuilder.Entity<ObjectiveProgressUpdate>()
            .HasQueryFilter(u => CurrentTenantId != Guid.Empty && u.TenantId == CurrentTenantId);

        modelBuilder.Entity<PerformanceCheckIn>()
            .HasQueryFilter(c => CurrentTenantId != Guid.Empty && c.TenantId == CurrentTenantId);

        modelBuilder.Entity<CheckInFollowUpAction>()
            .HasQueryFilter(a => CurrentTenantId != Guid.Empty && a.TenantId == CurrentTenantId);

        modelBuilder.Entity<ObjectiveDiscussionSignal>()
            .HasQueryFilter(s => CurrentTenantId != Guid.Empty && s.TenantId == CurrentTenantId);

        modelBuilder.Entity<Attachment>()
            .HasQueryFilter(a => CurrentTenantId != Guid.Empty && a.TenantId == CurrentTenantId);

        modelBuilder.Entity<EvaluationRatingScale>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRatingScaleLevel>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationTemplate>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationTemplateSection>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationTemplateQuestion>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRound>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundScaleDraftLevel>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundTemplateDraftSection>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundTemplateDraftQuestion>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundExclusion>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundReviewerCorrection>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundScaleSnapshot>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundScaleSnapshotLevel>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundTemplateSnapshot>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundTemplateSnapshotSection>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundTemplateSnapshotQuestion>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundPolicySnapshot>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundParticipant>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationObjectivePlanSnapshot>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationObjectiveSnapshot>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundDeadlineExtension>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationAssignment>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundSkillDraftItem>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundProficiencyDraftLevel>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundSkillSnapshot>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundSkillSnapshotLevel>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationRoundSkillSnapshotItem>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationObjectiveRating>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationSkillRating>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvaluationQuestionAnswer>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<SkillCategory>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<Skill>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<ProficiencyScale>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<ProficiencyScaleLevel>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<SkillExpectationSet>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);
        modelBuilder.Entity<SkillExpectationItem>()
            .HasQueryFilter(x => CurrentTenantId != Guid.Empty && x.TenantId == CurrentTenantId);

        modelBuilder.Entity<TenantObjectivePolicy>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<TenantObjectivePolicyVersion>()
            .HasQueryFilter(v => CurrentTenantId != Guid.Empty && v.TenantId == CurrentTenantId);

        // Strategic + phase shared entity tenant filters (Plan 03-02)
        modelBuilder.Entity<StrategicPeriod>()
            .HasQueryFilter(p => CurrentTenantId != Guid.Empty && p.TenantId == CurrentTenantId);

        modelBuilder.Entity<StrategicObjective>()
            .HasQueryFilter(o => CurrentTenantId != Guid.Empty && o.TenantId == CurrentTenantId);

        modelBuilder.Entity<ApprovalDelegate>()
            .HasQueryFilter(d => CurrentTenantId != Guid.Empty && d.TenantId == CurrentTenantId);
    }
}
