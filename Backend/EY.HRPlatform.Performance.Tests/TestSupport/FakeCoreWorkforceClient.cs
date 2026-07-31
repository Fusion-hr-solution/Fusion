using EY.HRPlatform.Performance.Infrastructure.Workforce;

namespace EY.HRPlatform.Performance.Tests.TestSupport;

/// <summary>Configurable fake of the Core workforce client for handler/resolver tests.</summary>
public sealed class FakeCoreWorkforceClient : ICoreWorkforceClient
{
    public List<CoreEmployeeSummary> ByScopeResult { get; set; } = [];
    public List<CoreEmployeeSummary> SnapshotByScopeResult { get; set; } = [];
    public List<CoreEmployeeSummary> ResolvePool { get; set; } = [];
    public List<CoreEmployeeSummary> SnapshotResolvePool { get; set; } = [];
    public Dictionary<Guid, List<CoreEmployeeSummary>> ManagerChains { get; } = [];
    public CoreCampaignWorkforceContext CampaignWorkforceContext { get; set; }
        = new(DateTime.UtcNow, "test", []);
    public List<DateTime> SnapshotAsOfCalls { get; } = [];

    /// <summary>Stubbable org-unit details keyed by org-unit id (D-16 seam #2).</summary>
    public Dictionary<Guid, CoreOrgUnitDetail> OrgUnitDetails { get; } = [];

    /// <summary>Stubbable org-unit member lists keyed by org-unit id (D-16 seam #2).</summary>
    public Dictionary<Guid, List<CoreEmployeeSummary>> OrgUnitMembers { get; } = [];

    public Task<IReadOnlyList<CoreEmployeeSummary>> ResolveEmployeesAsync(
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<CoreEmployeeSummary>>(
            ResolvePool.Where(e => employeeIds.Contains(e.EmployeeId)).ToList());

    public Task<IReadOnlyList<CoreEmployeeSummary>> ResolveEmployeesAsOfAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken)
    {
        SnapshotAsOfCalls.Add(asOf);
        return Task.FromResult<IReadOnlyList<CoreEmployeeSummary>>(
            SnapshotResolvePool.Where(e => employeeIds.Contains(e.EmployeeId)).ToList());
    }

    /// <summary>All active employees returned for the all-active population baseline (no scope set).</summary>
    public List<CoreEmployeeSummary> AllActiveResult { get; set; } = [];

    public Task<IReadOnlyList<CoreEmployeeSummary>> GetAllActiveEmployeesAsync(
        bool includeInactive,
        CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<CoreEmployeeSummary>>(
            includeInactive ? AllActiveResult : AllActiveResult.Where(e => e.IsActive).ToList());

    public Task<IReadOnlyList<CoreEmployeeSummary>> GetEmployeesByScopeAsync(
        IReadOnlyCollection<Guid> orgUnitIds,
        bool includeDescendants,
        bool includeInactive,
        CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<CoreEmployeeSummary>>(ByScopeResult);

    public Task<IReadOnlyList<CoreEmployeeSummary>> GetEmployeesByScopeAsOfAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> orgUnitIds,
        bool includeDescendants,
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        SnapshotAsOfCalls.Add(asOf);
        return Task.FromResult<IReadOnlyList<CoreEmployeeSummary>>(SnapshotByScopeResult);
    }

    public Task<IReadOnlyList<CoreEmployeeSummary>> GetManagerChainAsync(Guid employeeId, CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<CoreEmployeeSummary>>(
            ManagerChains.GetValueOrDefault(employeeId, []));

    public Task<CoreOrgUnitDetail?> GetOrgUnitAsync(Guid orgUnitId, CancellationToken cancellationToken)
        => Task.FromResult<CoreOrgUnitDetail?>(OrgUnitDetails.GetValueOrDefault(orgUnitId));

    public Task<IReadOnlyList<CoreEmployeeSummary>> GetOrgUnitMembersAsync(
        Guid orgUnitId,
        bool includeDescendants,
        CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<CoreEmployeeSummary>>(
            OrgUnitMembers.GetValueOrDefault(orgUnitId, []));

    public Task<CoreCampaignWorkforceContext> GetCampaignWorkforceContextAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken)
    {
        var members = CampaignWorkforceContext.Members
            .Where(member => employeeIds.Count == 0 || employeeIds.Contains(member.EmployeeId))
            .ToList();
        return Task.FromResult(CampaignWorkforceContext with { AsOf = asOf, Members = members });
    }

    public CoreApplicabilityOptions ApplicabilityOptions { get; set; }
        = new([], [], [], []);

    public Task<CoreApplicabilityOptions> GetApplicabilityOptionsAsync(CancellationToken cancellationToken)
        => Task.FromResult(ApplicabilityOptions);

    public static CoreEmployeeSummary Employee(Guid id, string name)
        => new(id, $"E-{id.ToString("N")[..6]}", name, name, $"{name}@test.local", "Engineer", true, null, null);
}
