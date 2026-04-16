using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence;

public class CoreHRDbContext : DbContext
{
    private readonly ITenantContext? _tenantContext;

    /// <summary>
    /// Runtime constructor with tenant context for production use.
    /// </summary>
    public CoreHRDbContext(DbContextOptions<CoreHRDbContext> options, ITenantContext tenantContext)
        : base(options)
    {
        _tenantContext = tenantContext;
    }

    /// <summary>
    /// Design-time constructor for EF migrations tooling.
    /// </summary>
    public CoreHRDbContext(DbContextOptions<CoreHRDbContext> options)
        : base(options)
    {
        _tenantContext = null;
    }

    /// <summary>
    /// Current tenant ID used for query filters. Returns Empty when no tenant resolved
    /// (design-time or unauthenticated), resulting in fail-closed query behavior.
    /// </summary>
    private Guid CurrentTenantId => _tenantContext?.TenantIdOrDefault ?? Guid.Empty;

    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<TenantSettings> TenantSettings => Set<TenantSettings>();
    public DbSet<OrgUnit> OrgUnits => Set<OrgUnit>();
    public DbSet<DraftOrgUnit> DraftOrgUnits => Set<DraftOrgUnit>();
    public DbSet<TenantSetupState> TenantSetupStates => Set<TenantSetupState>();

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

        modelBuilder.HasDefaultSchema("corehr");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CoreHRDbContext).Assembly);

        // Global tenant filter: all Employee queries automatically scoped to current tenant.
        // When CurrentTenantId is Empty (design-time/no context), queries return no results.
        modelBuilder.Entity<Employee>()
            .HasQueryFilter(e => CurrentTenantId != Guid.Empty && e.TenantId == CurrentTenantId);

        modelBuilder.Entity<TenantSettings>()
            .HasQueryFilter(ts => CurrentTenantId != Guid.Empty && ts.TenantId == CurrentTenantId);

        modelBuilder.Entity<OrgUnit>()
            .HasQueryFilter(o => CurrentTenantId != Guid.Empty && o.TenantId == CurrentTenantId);

        modelBuilder.Entity<DraftOrgUnit>()
            .HasQueryFilter(o => CurrentTenantId != Guid.Empty && o.TenantId == CurrentTenantId);

        modelBuilder.Entity<TenantSetupState>()
            .HasQueryFilter(ts => CurrentTenantId != Guid.Empty && ts.TenantId == CurrentTenantId);
    }
}
