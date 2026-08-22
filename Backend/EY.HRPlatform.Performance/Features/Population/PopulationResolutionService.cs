using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Infrastructure.Core;

namespace EY.HRPlatform.Performance.Features.Population;

/// <summary>
/// Resolves a Cycle's population authoritatively on the backend: it reads Core workforce truth
/// through the signed internal snapshot contract (all-active-as-of / by-scope / resolve),
/// applies the stored rule's inclusions/exclusions, and derives readiness. The frontend only
/// sends selected OrgUnit ids and descendant intent — it never computes eligibility or builds
/// the roster.
/// </summary>
public sealed class PopulationResolutionService(ICoreWorkforceClient workforceClient)
{
    public async Task<PopulationResolution> ResolveAsync(
        PerformanceCycle cycle,
        PopulationDefinition definition,
        CancellationToken cancellationToken)
    {
        var asOf = cycle.StartDate.ToDateTime(TimeOnly.MinValue);

        var baseSnapshots = definition.Mode switch
        {
            PopulationMode.AllActive => await workforceClient.GetAllActiveAsOfAsync(asOf, cancellationToken),
            PopulationMode.ByScope => await ResolveByScopeAsync(asOf, definition, cancellationToken),
            _ => [],
        };

        var byEmployee = baseSnapshots.ToDictionary(snapshot => snapshot.EmployeeId);

        // Explicit inclusions may reference employees outside the base scope (or ineligible
        // ones). Resolve them by id so eligibility is judged from real Core truth, letting an
        // inclusion add someone in scope while still rejecting invalid employment/assignment.
        var inclusionIds = definition.Inclusions
            .Select(inclusion => inclusion.EmployeeId)
            .Where(id => !byEmployee.ContainsKey(id))
            .ToList();

        if (inclusionIds.Count > 0)
        {
            foreach (var snapshot in await workforceClient.ResolveAsync(asOf, inclusionIds, cancellationToken))
            {
                byEmployee[snapshot.EmployeeId] = snapshot;
            }
        }

        var candidates = byEmployee.Values
            .Select(snapshot => ToCandidate(snapshot, definition))
            .OrderByDescending(candidate => candidate.CountsToRoster)
            .ThenBy(candidate => candidate.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new PopulationResolution(definition.Mode, definition.EligibilityDate, definition.IsConfirmed, candidates);
    }

    private async Task<IReadOnlyList<WorkforceSnapshot>> ResolveByScopeAsync(
        DateTime asOf,
        PopulationDefinition definition,
        CancellationToken cancellationToken)
    {
        // Core's by-scope takes one descendant flag per call, so group the selected units by
        // their descendant intent and merge (a unit resolved with descendants supersedes the
        // same unit resolved without).
        var withDescendants = definition.OrgUnitSelections
            .Where(selection => selection.IncludeDescendants)
            .Select(selection => selection.OrgUnitId)
            .ToList();
        var withoutDescendants = definition.OrgUnitSelections
            .Where(selection => !selection.IncludeDescendants)
            .Select(selection => selection.OrgUnitId)
            .ToList();

        var merged = new Dictionary<Guid, WorkforceSnapshot>();

        if (withDescendants.Count > 0)
        {
            foreach (var snapshot in await workforceClient.GetByScopeAsync(asOf, withDescendants, includeDescendants: true, cancellationToken))
                merged[snapshot.EmployeeId] = snapshot;
        }

        if (withoutDescendants.Count > 0)
        {
            foreach (var snapshot in await workforceClient.GetByScopeAsync(asOf, withoutDescendants, includeDescendants: false, cancellationToken))
                merged.TryAdd(snapshot.EmployeeId, snapshot);
        }

        return merged.Values.ToList();
    }

    private static PopulationCandidate ToCandidate(WorkforceSnapshot snapshot, PopulationDefinition definition)
    {
        var issues = new List<ReadinessIssueCode>();
        if (!snapshot.IsActive) issues.Add(ReadinessIssueCode.InactiveEmployment);
        if (snapshot.OrgUnit is null) issues.Add(ReadinessIssueCode.NoPrimaryAssignment);
        if (snapshot.Manager is null) issues.Add(ReadinessIssueCode.MissingManager);

        var excluded = definition.IsExcluded(snapshot.EmployeeId);

        return new PopulationCandidate(
            snapshot.EmployeeId,
            snapshot.DisplayName,
            snapshot.JobTitle,
            snapshot.OrgUnit?.OrgUnitId,
            snapshot.OrgUnit?.Name,
            snapshot.Manager?.EmployeeId,
            snapshot.Manager?.DisplayName,
            snapshot.IsActive,
            definition.IsExplicitlyIncluded(snapshot.EmployeeId),
            excluded,
            excluded ? definition.ExclusionReason(snapshot.EmployeeId) : null,
            issues);
    }
}
