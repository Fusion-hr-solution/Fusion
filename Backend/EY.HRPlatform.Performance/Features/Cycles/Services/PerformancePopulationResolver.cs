using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.Performance.Features.Cycles.Services;

/// <summary>
/// Resolves a cycle's population rules into a concrete member list by querying the Core
/// workforce contract. Used for live preview (Draft) and snapshot materialisation (Publish).
/// Resolution = union(org-unit scopes) + explicit includes - explicit excludes.
/// </summary>
public interface IPerformancePopulationResolver
{
    Task<IReadOnlyList<CoreEmployeeSummary>> ResolveAsync(
        PerformanceCycle cycle,
        DateTime? asOf,
        CancellationToken cancellationToken);
}

/// <remarks>
/// Resolves the whole population in one pass, so it takes the bulk Core HR policy: a longer
/// deadline and no retry.
/// </remarks>
public sealed class PerformancePopulationResolver(
    [FromKeyedServices(CoreWorkforceClientNames.Bulk)] ICoreWorkforceClient workforceClient)
    : IPerformancePopulationResolver
{
    public async Task<IReadOnlyList<CoreEmployeeSummary>> ResolveAsync(
        PerformanceCycle cycle,
        DateTime? asOf,
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

        var hasPositiveScope =
            orgUnitWithDescendants.Count > 0 ||
            orgUnitDirectOnly.Count > 0 ||
            includeEmployeeIds.Count > 0;

        // No implicit all-workforce baseline. HR must choose a positive scope before
        // readiness/launch can materialise participants.
        if (!hasPositiveScope)
        {
            return [];
        }

        if (orgUnitWithDescendants.Count > 0)
        {
            Merge(asOf.HasValue
                ? await workforceClient.GetEmployeesByScopeAsOfAsync(
                    asOf.Value, orgUnitWithDescendants, includeDescendants: true, cycle.PopulationIncludeInactive, cancellationToken)
                : await workforceClient.GetEmployeesByScopeAsync(
                    orgUnitWithDescendants, includeDescendants: true, cycle.PopulationIncludeInactive, cancellationToken));
        }

        if (orgUnitDirectOnly.Count > 0)
        {
            Merge(asOf.HasValue
                ? await workforceClient.GetEmployeesByScopeAsOfAsync(
                    asOf.Value, orgUnitDirectOnly, includeDescendants: false, cycle.PopulationIncludeInactive, cancellationToken)
                : await workforceClient.GetEmployeesByScopeAsync(
                    orgUnitDirectOnly, includeDescendants: false, cycle.PopulationIncludeInactive, cancellationToken));
        }

        // Explicit includes are intentional and added regardless of status filter.
        if (includeEmployeeIds.Count > 0)
        {
            Merge(asOf.HasValue
                ? await workforceClient.ResolveEmployeesAsOfAsync(asOf.Value, includeEmployeeIds, cancellationToken)
                : await workforceClient.ResolveEmployeesAsync(includeEmployeeIds, cancellationToken));
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
