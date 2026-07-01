using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Workforce;

namespace EY.HRPlatform.Performance.Features.Cycles.Services;

/// <summary>
/// Resolves a cycle's population rules into a concrete member list by querying the Core
/// workforce contract. Used for live preview (Draft) and snapshot materialisation (Publish).
/// Resolution = union(org-unit scopes) + explicit includes - explicit excludes.
/// </summary>
public interface IPerformancePopulationResolver
{
    Task<IReadOnlyList<CoreEmployeeSummary>> ResolveAsync(PerformanceCycle cycle, CancellationToken cancellationToken);
}

public sealed class PerformancePopulationResolver(ICoreWorkforceClient workforceClient) : IPerformancePopulationResolver
{
    public async Task<IReadOnlyList<CoreEmployeeSummary>> ResolveAsync(
        PerformanceCycle cycle,
        CancellationToken cancellationToken)
    {
        var orgUnitWithDescendants = cycle.PopulationRules
            .Where(rule => rule.RuleType == PopulationRuleType.OrgUnit && rule.IncludeDescendants)
            .Select(rule => rule.RefId)
            .Distinct()
            .ToList();

        var orgUnitDirectOnly = cycle.PopulationRules
            .Where(rule => rule.RuleType == PopulationRuleType.OrgUnit && !rule.IncludeDescendants)
            .Select(rule => rule.RefId)
            .Distinct()
            .ToList();

        var includeEmployeeIds = cycle.PopulationRules
            .Where(rule => rule.RuleType == PopulationRuleType.IncludeEmployee)
            .Select(rule => rule.RefId)
            .Distinct()
            .ToList();

        var excludeEmployeeIds = cycle.PopulationRules
            .Where(rule => rule.RuleType == PopulationRuleType.ExcludeEmployee)
            .Select(rule => rule.RefId)
            .ToHashSet();

        var membersById = new Dictionary<Guid, CoreEmployeeSummary>();

        void Merge(IEnumerable<CoreEmployeeSummary> employees)
        {
            foreach (var employee in employees)
            {
                membersById[employee.EmployeeId] = employee;
            }
        }

        if (orgUnitWithDescendants.Count > 0)
        {
            Merge(await workforceClient.GetEmployeesByScopeAsync(
                orgUnitWithDescendants, includeDescendants: true, cycle.PopulationIncludeInactive, cancellationToken));
        }

        if (orgUnitDirectOnly.Count > 0)
        {
            Merge(await workforceClient.GetEmployeesByScopeAsync(
                orgUnitDirectOnly, includeDescendants: false, cycle.PopulationIncludeInactive, cancellationToken));
        }

        // Explicit includes are intentional and added regardless of status filter.
        if (includeEmployeeIds.Count > 0)
        {
            Merge(await workforceClient.ResolveEmployeesAsync(includeEmployeeIds, cancellationToken));
        }

        foreach (var excludedId in excludeEmployeeIds)
        {
            membersById.Remove(excludedId);
        }

        return membersById.Values
            .OrderBy(employee => employee.FullName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
