using System.Linq.Expressions;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Domain.Entities.Skills;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Persistence;
using Microsoft.EntityFrameworkCore;

using EY.HRPlatform.DemoSeed;

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
    public DbSet<CanonicalSeedReceipt> CanonicalSeedReceipts => Set<CanonicalSeedReceipt>();

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

    public DbSet<ApprovalDelegate> ApprovalDelegates => Set<ApprovalDelegate>();

    /// <summary>Attachment bytes, when the database-backed storage backend is selected (D11).</summary>
    public DbSet<AttachmentBlob> AttachmentBlobs => Set<AttachmentBlob>();


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
        modelBuilder.Entity<CanonicalSeedReceipt>(entity =>
        {
            entity.ToTable("CanonicalSeedReceipts");
            entity.HasKey(receipt => receipt.Id);
            entity.HasIndex(receipt => new { receipt.TenantId, receipt.ManifestVersion }).IsUnique();
            entity.Property(receipt => receipt.ManifestVersion).HasMaxLength(200).IsRequired();
            entity.Property(receipt => receipt.ManifestHash).HasMaxLength(128).IsRequired();
        });

        modelBuilder.HasDefaultSchema("performance");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PerformanceDbContext).Assembly);

        ApplyTenantQueryFilters(modelBuilder);
    }

    /// <summary>
    /// Entities that are deliberately platform-scoped: they carry no <see cref="ITenantEntity"/>
    /// and are gated by PlatformAdmin authorization instead of a tenant filter.
    /// </summary>
    /// <remarks>
    /// This list is the reviewable artifact that makes the exception set explicit rather than an
    /// absence. <c>TenantQueryFilterCoverageTests</c> fails when a mapped entity is neither
    /// tenant-filtered nor named here, so a new entity cannot ship readable across tenants.
    /// </remarks>
    internal static readonly IReadOnlySet<string> PlatformScopedEntities = new HashSet<string>(StringComparer.Ordinal)
    {
        nameof(Domain.Entities.ScheduledJobRun),
        nameof(Domain.Entities.Platform.PlatformPerformanceGuardrails),
        nameof(Domain.Entities.Platform.PlatformObjectiveBaseline),
        nameof(Domain.Entities.Platform.PlatformObjectiveBaselineVersion),
        nameof(Domain.Entities.PerformanceConfigurationAuditEntry),

        // Bytes, addressed only through the tenant-filtered Attachment row that owns them, by a
        // storage key that is itself tenant-partitioned.
        nameof(Domain.Entities.AttachmentBlob)
    };

    /// <summary>
    /// Applies the tenant filter by convention to every <see cref="ITenantEntity"/> in the model,
    /// replacing what were 59 hand-written registrations where the 60th would eventually be
    /// forgotten with no compiler error and no failing test.
    /// </summary>
    /// <remarks>
    /// The expression shape is unchanged: when the tenant is unresolved (design-time, or a request
    /// with no tenant context) <c>CurrentTenantId</c> is <see cref="Guid.Empty"/> and every query
    /// returns nothing rather than everything. Owned types are skipped deliberately — EF applies
    /// their owner's filter, and filtering them independently is invalid.
    /// </remarks>
    private void ApplyTenantQueryFilters(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (entityType.IsOwned() || !typeof(ITenantEntity).IsAssignableFrom(entityType.ClrType))
            {
                continue;
            }

            var entity = Expression.Parameter(entityType.ClrType, "entity");
            // Closes over this context instance, exactly as the hand-written lambdas did, so the
            // tenant is read per query rather than baked into the cached model.
            var currentTenantId = Expression.Property(Expression.Constant(this), nameof(CurrentTenantId));

            // entity => CurrentTenantId != Guid.Empty && entity.TenantId == CurrentTenantId
            var filter = Expression.Lambda(
                Expression.AndAlso(
                    Expression.NotEqual(currentTenantId, Expression.Constant(Guid.Empty)),
                    Expression.Equal(
                        Expression.Property(entity, nameof(ITenantEntity.TenantId)),
                        currentTenantId)),
                entity);

            modelBuilder.Entity(entityType.ClrType).HasQueryFilter(filter);
        }
    }
}
