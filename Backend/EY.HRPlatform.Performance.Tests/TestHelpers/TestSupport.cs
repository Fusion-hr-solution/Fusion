using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Persistence.Interceptors;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace EY.HRPlatform.Performance.Tests.TestHelpers;

public sealed class TestTenantContext(Guid? tenantId = null) : ITenantContext
{
    public Guid TenantId => tenantId ?? throw new InvalidOperationException("Tenant not resolved.");
    public bool IsResolved => tenantId.HasValue;
    public Guid? TenantIdOrDefault => tenantId;

    public static TestTenantContext WithTenant(Guid id) => new(id);
    public static TestTenantContext Unresolved() => new(null);
}

/// <summary>
/// A shared InMemory store fronted by a factory that hands out a fresh DbContext per call — so
/// tests exercise handlers the way production does (one scoped context per request) instead of
/// reusing a single long-lived context, which InMemory mistracks across saves.
/// </summary>
public sealed class TestStore(Guid tenantId)
{
    private readonly InMemoryDatabaseRoot _root = new();
    private readonly string _name = Guid.NewGuid().ToString();

    public Guid TenantId { get; } = tenantId;
    public ITenantContext Tenant { get; } = TestTenantContext.WithTenant(tenantId);

    public PerformanceDbContext NewContext() => NewContext(Tenant);

    public PerformanceDbContext NewContext(ITenantContext tenant)
    {
        var options = new DbContextOptionsBuilder<PerformanceDbContext>()
            .UseInMemoryDatabase(_name, _root)
            .AddInterceptors(new TenantSaveChangesInterceptor(tenant))
            .Options;
        return new PerformanceDbContext(options, tenant);
    }

    public static TestStore ForNewTenant() => new(Guid.NewGuid());
}

/// <summary>
/// A configurable stand-in for the Core internal snapshot contract. Tests set what each mode
/// returns for a given as-of date so eligibility resolution can be exercised deterministically.
/// </summary>
public sealed class FakeCoreWorkforceClient : ICoreWorkforceClient
{
    public List<WorkforceSnapshot> AllActive { get; } = [];
    public Dictionary<Guid, WorkforceSnapshot> ById { get; } = [];
    public DateTime? LastAsOf { get; private set; }

    public Task<IReadOnlyList<WorkforceSnapshot>> GetAllActiveAsOfAsync(DateTime asOf, CancellationToken cancellationToken)
    {
        LastAsOf = asOf;
        return Task.FromResult<IReadOnlyList<WorkforceSnapshot>>(AllActive.ToList());
    }

    public Task<IReadOnlyList<WorkforceSnapshot>> GetByScopeAsync(
        DateTime asOf, IReadOnlyCollection<Guid> orgUnitIds, bool includeDescendants, CancellationToken cancellationToken)
    {
        LastAsOf = asOf;
        var inScope = AllActive
            .Where(snapshot => snapshot.OrgUnit is not null && orgUnitIds.Contains(snapshot.OrgUnit.OrgUnitId))
            .ToList();
        return Task.FromResult<IReadOnlyList<WorkforceSnapshot>>(inScope);
    }

    public Task<IReadOnlyList<WorkforceSnapshot>> ResolveAsync(
        DateTime asOf, IReadOnlyCollection<Guid> employeeIds, CancellationToken cancellationToken)
    {
        LastAsOf = asOf;
        var resolved = employeeIds
            .Where(ById.ContainsKey)
            .Select(id => ById[id])
            .ToList();
        return Task.FromResult<IReadOnlyList<WorkforceSnapshot>>(resolved);
    }

    public WorkforceSnapshot Add(
        string name,
        bool isActive = true,
        Guid? orgUnitId = null,
        string orgUnitName = "Engineering",
        Guid? managerId = null)
    {
        var snapshot = new WorkforceSnapshot(
            Guid.NewGuid(),
            $"KEY-{name}",
            name,
            name,
            $"{name}@demo.local",
            "Engineer",
            isActive,
            isActive && orgUnitId is not null ? new WorkforceOrgSnapshot(orgUnitId.Value, orgUnitName) : (orgUnitId is not null ? new WorkforceOrgSnapshot(orgUnitId.Value, orgUnitName) : null),
            managerId is not null ? new WorkforceManagerSnapshot(managerId.Value, "Manager", true) : null);
        AllActive.Add(snapshot);
        ById[snapshot.EmployeeId] = snapshot;
        return snapshot;
    }

    public void AddIneligible(string name, bool inactive, bool noAssignment, out Guid id)
    {
        var snapshot = new WorkforceSnapshot(
            Guid.NewGuid(),
            $"KEY-{name}",
            name,
            name,
            null,
            null,
            !inactive,
            noAssignment ? null : new WorkforceOrgSnapshot(Guid.NewGuid(), "Engineering"),
            null);
        id = snapshot.EmployeeId;
        ById[snapshot.EmployeeId] = snapshot; // resolvable by id, but NOT in the all-active base set
    }
}
