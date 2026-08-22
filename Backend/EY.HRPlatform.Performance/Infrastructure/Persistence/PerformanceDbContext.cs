using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence;

/// <summary>
/// The Performance module's own persistence context. Schema <c>performance</c>, fail-closed
/// per-entity tenant query filter, UTC datetime conversion. Owns the Cycle &amp; Goals domain
/// and consumes Core workforce/organization truth only through the internal snapshot contract.
/// </summary>
public sealed class PerformanceDbContext : DbContext
{
    private readonly ITenantContext? _tenantContext;

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

    private Guid CurrentTenantId => _tenantContext?.TenantIdOrDefault ?? Guid.Empty;

    public DbSet<PerformanceCycle> Cycles => Set<PerformanceCycle>();
    public DbSet<CycleSettings> CycleSettings => Set<CycleSettings>();
    public DbSet<PopulationDefinition> PopulationDefinitions => Set<PopulationDefinition>();
    public DbSet<Participant> Participants => Set<Participant>();
    public DbSet<Objective> Objectives => Set<Objective>();
    public DbSet<ContributionLink> ContributionLinks => Set<ContributionLink>();
    public DbSet<ObjectiveDecision> ObjectiveDecisions => Set<ObjectiveDecision>();
    public DbSet<EmployeePlan> EmployeePlans => Set<EmployeePlan>();
    public DbSet<PlanDecision> PlanDecisions => Set<PlanDecision>();
    public DbSet<ProgressUpdate> ProgressUpdates => Set<ProgressUpdate>();
    public DbSet<EvidenceItem> EvidenceItems => Set<EvidenceItem>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<UtcNullableDateTimeConverter>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasDefaultSchema("performance");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PerformanceDbContext).Assembly);

        // Fail-closed tenant filter on every root: an unresolved tenant returns no rows.
        modelBuilder.Entity<PerformanceCycle>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);
        modelBuilder.Entity<ActivationSnapshot>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);
        modelBuilder.Entity<CycleSettings>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);
        modelBuilder.Entity<PopulationDefinition>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);
        modelBuilder.Entity<PopulationOrgUnitSelection>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);
        modelBuilder.Entity<PopulationInclusion>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);
        modelBuilder.Entity<PopulationExclusion>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);
        modelBuilder.Entity<Participant>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);
        modelBuilder.Entity<Objective>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);
        modelBuilder.Entity<ContributionLink>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);
        modelBuilder.Entity<ObjectiveDecision>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);
        modelBuilder.Entity<EmployeePlan>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);
        modelBuilder.Entity<PlanDecision>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);
        modelBuilder.Entity<ProgressUpdate>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);
        modelBuilder.Entity<EvidenceItem>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);
    }
}
