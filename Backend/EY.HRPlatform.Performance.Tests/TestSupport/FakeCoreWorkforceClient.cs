using EY.HRPlatform.Performance.Infrastructure.Workforce;

namespace EY.HRPlatform.Performance.Tests.TestSupport;

/// <summary>Configurable fake of the Core workforce client for handler/resolver tests.</summary>
public sealed class FakeCoreWorkforceClient : ICoreWorkforceClient
{
    public List<CoreEmployeeSummary> ByScopeResult { get; set; } = [];
    public List<CoreEmployeeSummary> ResolvePool { get; set; } = [];
    public Dictionary<Guid, List<CoreEmployeeSummary>> ManagerChains { get; } = [];

    public Task<IReadOnlyList<CoreEmployeeSummary>> ResolveEmployeesAsync(
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<CoreEmployeeSummary>>(
            ResolvePool.Where(e => employeeIds.Contains(e.EmployeeId)).ToList());

    public Task<IReadOnlyList<CoreEmployeeSummary>> GetEmployeesByScopeAsync(
        IReadOnlyCollection<Guid> orgUnitIds,
        bool includeDescendants,
        bool includeInactive,
        CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<CoreEmployeeSummary>>(ByScopeResult);

    public Task<IReadOnlyList<CoreEmployeeSummary>> GetManagerChainAsync(Guid employeeId, CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<CoreEmployeeSummary>>(
            ManagerChains.GetValueOrDefault(employeeId, []));

    public static CoreEmployeeSummary Employee(Guid id, string name)
        => new(id, $"E-{id.ToString("N")[..6]}", name, name, $"{name}@test.local", "Engineer", true, null, null);
}
