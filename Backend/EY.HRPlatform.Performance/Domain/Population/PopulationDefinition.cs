using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Population;

/// <summary>
/// How a Cycle's population is selected: the mode, any selected organizational units, and
/// explicit individual inclusions/exclusions. One per Cycle. This records the <em>rule</em>;
/// the confirmed named roster is the set of <see cref="Participant"/> records frozen at
/// confirmation. Eligibility is always evaluated as-of the Cycle start date.
/// </summary>
public sealed class PopulationDefinition : PerformanceAggregate
{
    private readonly List<PopulationOrgUnitSelection> _orgUnitSelections = [];
    private readonly List<PopulationInclusion> _inclusions = [];
    private readonly List<PopulationExclusion> _exclusions = [];

    private PopulationDefinition() { }

    public Guid CycleId { get; private set; }
    public PopulationMode Mode { get; private set; }
    public DateOnly EligibilityDate { get; private set; }
    public bool IsConfirmed { get; private set; }
    public DateTime? ConfirmedAt { get; private set; }

    public IReadOnlyList<PopulationOrgUnitSelection> OrgUnitSelections => _orgUnitSelections;
    public IReadOnlyList<PopulationInclusion> Inclusions => _inclusions;
    public IReadOnlyList<PopulationExclusion> Exclusions => _exclusions;

    public static PopulationDefinition Create(Guid tenantId, Guid cycleId, DateOnly eligibilityDate)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId is required.", nameof(tenantId));
        if (cycleId == Guid.Empty) throw new ArgumentException("CycleId is required.", nameof(cycleId));

        return new PopulationDefinition
        {
            TenantId = tenantId,
            CycleId = cycleId,
            Mode = PopulationMode.AllActive,
            EligibilityDate = eligibilityDate,
        };
    }

    /// <summary>Replaces the selection rule. Editing the rule clears any prior confirmation.</summary>
    public void SetSelection(
        PopulationMode mode,
        IEnumerable<(Guid OrgUnitId, bool IncludeDescendants)> orgUnitSelections,
        IEnumerable<Guid> inclusions,
        IEnumerable<(Guid EmployeeId, string Reason)> exclusions)
    {
        GuardDraft();

        _orgUnitSelections.Clear();
        _inclusions.Clear();
        _exclusions.Clear();

        if (mode == PopulationMode.ByScope)
        {
            foreach (var (orgUnitId, includeDescendants) in orgUnitSelections ?? [])
            {
                if (orgUnitId == Guid.Empty) continue;
                if (_orgUnitSelections.Any(selection => selection.OrgUnitId == orgUnitId)) continue;
                _orgUnitSelections.Add(PopulationOrgUnitSelection.Create(TenantId, Id, orgUnitId, includeDescendants));
            }

            // Zero selected units is a valid intermediate state (the admin has chosen the scope
            // mode but not yet picked units); it simply resolves to an empty population. Emptiness
            // is enforced at confirmation/activation, not while the rule is still being edited.
        }

        foreach (var employeeId in (inclusions ?? []).Where(id => id != Guid.Empty).Distinct())
        {
            _inclusions.Add(PopulationInclusion.Create(TenantId, Id, employeeId));
        }

        foreach (var (employeeId, reason) in exclusions ?? [])
        {
            if (employeeId == Guid.Empty) continue;
            if (string.IsNullOrWhiteSpace(reason))
                throw new InvalidOperationException("An exclusion requires a reason.");
            if (_exclusions.Any(exclusion => exclusion.EmployeeId == employeeId)) continue;
            _exclusions.Add(PopulationExclusion.Create(TenantId, Id, employeeId, reason.Trim()));
        }

        Mode = mode;
        IsConfirmed = false;
        ConfirmedAt = null;
        MarkUpdated();
    }

    public void MarkConfirmed()
    {
        GuardDraft();
        IsConfirmed = true;
        ConfirmedAt = DateTime.UtcNow;
        MarkUpdated();
    }

    public void Reopen()
    {
        GuardDraft();
        IsConfirmed = false;
        ConfirmedAt = null;
        MarkUpdated();
    }

    /// <summary>
    /// Realigns eligibility to a new as-of date (the Cycle's start date). Because the roster is
    /// resolved as-of this date, moving it invalidates any prior confirmation — the caller must
    /// re-resolve and re-confirm against the new date.
    /// </summary>
    public void RealignEligibility(DateOnly eligibilityDate)
    {
        GuardDraft();
        if (eligibilityDate == EligibilityDate) return;
        EligibilityDate = eligibilityDate;
        IsConfirmed = false;
        ConfirmedAt = null;
        MarkUpdated();
    }

    private void GuardDraft()
    {
        // The confirmed-vs-draft distinction here is about the population rule while the
        // Cycle is still Draft. The Cycle aggregate guards that population is only edited
        // before activation; this aggregate carries no lifecycle of its own beyond confirm.
    }

    /// <summary>
    /// Whether the given selection is effectively identical to the current one after the same
    /// normalization <see cref="SetSelection"/> applies (dedup, trimmed reasons, order-independent).
    /// Lets the caller treat an equivalent re-send as a no-op and preserve confirmation, rather
    /// than reopening the population every time the same rule is PUT.
    /// </summary>
    public bool MatchesSelection(
        PopulationMode mode,
        IEnumerable<(Guid OrgUnitId, bool IncludeDescendants)> orgUnitSelections,
        IEnumerable<Guid> inclusions,
        IEnumerable<(Guid EmployeeId, string Reason)> exclusions)
    {
        if (mode != Mode) return false;

        var incomingOrg = mode == PopulationMode.ByScope
            ? NormalizeOrgSelections(orgUnitSelections)
            : new HashSet<(Guid, bool)>();
        var currentOrg = NormalizeOrgSelections(
            _orgUnitSelections.Select(selection => (selection.OrgUnitId, selection.IncludeDescendants)));
        if (!incomingOrg.SetEquals(currentOrg)) return false;

        var incomingInclusions = (inclusions ?? []).Where(id => id != Guid.Empty).ToHashSet();
        var currentInclusions = _inclusions.Select(inclusion => inclusion.EmployeeId).ToHashSet();
        if (!incomingInclusions.SetEquals(currentInclusions)) return false;

        var incomingExclusions = NormalizeExclusions(exclusions);
        var currentExclusions = NormalizeExclusions(
            _exclusions.Select(exclusion => (exclusion.EmployeeId, exclusion.Reason)));
        return incomingExclusions.SetEquals(currentExclusions);
    }

    private static HashSet<(Guid, bool)> NormalizeOrgSelections(
        IEnumerable<(Guid OrgUnitId, bool IncludeDescendants)> selections)
    {
        var result = new HashSet<(Guid, bool)>();
        var seen = new HashSet<Guid>();
        foreach (var (orgUnitId, includeDescendants) in selections ?? [])
        {
            if (orgUnitId == Guid.Empty) continue;
            if (!seen.Add(orgUnitId)) continue; // first selection for a unit wins, mirroring SetSelection
            result.Add((orgUnitId, includeDescendants));
        }

        return result;
    }

    private static HashSet<(Guid, string)> NormalizeExclusions(
        IEnumerable<(Guid EmployeeId, string Reason)> exclusions)
    {
        var result = new HashSet<(Guid, string)>();
        var seen = new HashSet<Guid>();
        foreach (var (employeeId, reason) in exclusions ?? [])
        {
            if (employeeId == Guid.Empty) continue;
            if (!seen.Add(employeeId)) continue;
            result.Add((employeeId, (reason ?? string.Empty).Trim()));
        }

        return result;
    }

    public bool IsExcluded(Guid employeeId) => _exclusions.Any(exclusion => exclusion.EmployeeId == employeeId);

    public bool IsExplicitlyIncluded(Guid employeeId) => _inclusions.Any(inclusion => inclusion.EmployeeId == employeeId);

    public string? ExclusionReason(Guid employeeId)
        => _exclusions.FirstOrDefault(exclusion => exclusion.EmployeeId == employeeId)?.Reason;
}

public sealed class PopulationOrgUnitSelection : PerformanceChildEntity
{
    private PopulationOrgUnitSelection() { }

    public Guid PopulationDefinitionId { get; private set; }
    public Guid OrgUnitId { get; private set; }
    public bool IncludeDescendants { get; private set; }

    public static PopulationOrgUnitSelection Create(Guid tenantId, Guid populationDefinitionId, Guid orgUnitId, bool includeDescendants)
        => new()
        {
            TenantId = tenantId,
            PopulationDefinitionId = populationDefinitionId,
            OrgUnitId = orgUnitId,
            IncludeDescendants = includeDescendants,
        };
}

public sealed class PopulationInclusion : PerformanceChildEntity
{
    private PopulationInclusion() { }

    public Guid PopulationDefinitionId { get; private set; }
    public Guid EmployeeId { get; private set; }

    public static PopulationInclusion Create(Guid tenantId, Guid populationDefinitionId, Guid employeeId)
        => new()
        {
            TenantId = tenantId,
            PopulationDefinitionId = populationDefinitionId,
            EmployeeId = employeeId,
        };
}

public sealed class PopulationExclusion : PerformanceChildEntity
{
    private PopulationExclusion() { }

    public Guid PopulationDefinitionId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string Reason { get; private set; } = string.Empty;

    public static PopulationExclusion Create(Guid tenantId, Guid populationDefinitionId, Guid employeeId, string reason)
        => new()
        {
            TenantId = tenantId,
            PopulationDefinitionId = populationDefinitionId,
            EmployeeId = employeeId,
            Reason = reason,
        };
}
