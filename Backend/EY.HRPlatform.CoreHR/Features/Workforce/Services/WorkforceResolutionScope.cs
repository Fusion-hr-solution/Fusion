using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;

namespace EY.HRPlatform.CoreHR.Features.Workforce.Services;

/// <summary>
/// Scoped switch a bulk operation can flip to tell the workforce resolvers that the EF change
/// tracker already holds the authoritative graph for the whole run. When set, the resolvers skip
/// their per-row database fallbacks and walk the tracked (<c>.Local</c>) graph instead — this is
/// what keeps the employee-import apply loop from issuing tens of thousands of serialized round
/// trips. Defaults to normal DB-backed resolution, so single-employee API mutations are unaffected.
/// </summary>
public sealed class WorkforceResolutionScope
{
    private readonly Dictionary<Guid, Employee> _employeesById = [];
    private readonly Dictionary<Guid, OrgUnit> _orgUnitsById = [];
    private readonly Dictionary<Guid, List<Employment>> _employmentsByEmployeeId = [];
    private readonly Dictionary<Guid, List<WorkAssignment>> _assignmentsByEmployeeId = [];
    private readonly Dictionary<Guid, List<ManagerRelationship>> _primaryManagersBySubjectId = [];

    /// <summary>
    /// When <c>true</c>, resolvers treat the change tracker as authoritative and do not fall back
    /// to the database on a <c>.Local</c> miss. Set only inside a run that has preloaded the full
    /// working set (see <c>EmployeeImportWorkflowService.PreloadApplyStateAsync</c>).
    /// </summary>
    public bool TrackedGraphOnly { get; set; }

    public void ClearIndexes()
    {
        _employeesById.Clear();
        _orgUnitsById.Clear();
        _employmentsByEmployeeId.Clear();
        _assignmentsByEmployeeId.Clear();
        _primaryManagersBySubjectId.Clear();
    }

    public void Register(Employee employee) => _employeesById[employee.Id] = employee;

    public void Register(OrgUnit orgUnit) => _orgUnitsById[orgUnit.Id] = orgUnit;

    public void Register(Employment employment) => AddByEmployeeId(_employmentsByEmployeeId, employment.EmployeeId, employment);

    public void Register(WorkAssignment assignment) => AddByEmployeeId(_assignmentsByEmployeeId, assignment.EmployeeId, assignment);

    public void Register(ManagerRelationship relationship)
    {
        if (relationship.Type != ReportingRelationshipType.PrimaryManager)
            return;

        AddByEmployeeId(_primaryManagersBySubjectId, relationship.SubjectEmployeeId, relationship);
    }

    public Employee? FindEmployee(Guid employeeId)
        => _employeesById.GetValueOrDefault(employeeId);

    public OrgUnit? FindOrgUnit(Guid orgUnitId)
        => _orgUnitsById.GetValueOrDefault(orgUnitId);

    public Employment? ResolveActiveEmployment(Guid employeeId, DateTime asOf)
        => ResolveLatestActive(_employmentsByEmployeeId, employeeId, asOf, employment => employment.IsActiveOn(asOf));

    public WorkAssignment? ResolveActivePrimaryAssignment(Guid employeeId, DateTime asOf)
        => ResolveLatestActive(
            _assignmentsByEmployeeId,
            employeeId,
            asOf,
            assignment => assignment.IsPrimary && assignment.IsActiveOn(asOf));

    public ManagerRelationship? ResolveActivePrimaryManagerRelationship(Guid employeeId, DateTime asOf)
        => ResolveLatestActive(
            _primaryManagersBySubjectId,
            employeeId,
            asOf,
            relationship => relationship.IsActiveOn(asOf));

    public IReadOnlyList<Guid> GetManagerChain(Guid employeeId, DateTime asOf, int maxDepth)
    {
        var chain = new List<Guid>();
        var visited = new HashSet<Guid> { employeeId };
        var current = employeeId;

        while (chain.Count < maxDepth)
        {
            var relationship = ResolveActivePrimaryManagerRelationship(current, asOf);
            if (relationship is null || !visited.Add(relationship.ManagerEmployeeId))
                break;

            chain.Add(relationship.ManagerEmployeeId);
            current = relationship.ManagerEmployeeId;
        }

        return chain;
    }

    private static void AddByEmployeeId<T>(Dictionary<Guid, List<T>> index, Guid employeeId, T value)
    {
        if (!index.TryGetValue(employeeId, out var values))
        {
            values = [];
            index[employeeId] = values;
        }

        if (!values.Contains(value))
            values.Add(value);
    }

    private static T? ResolveLatestActive<T>(
        Dictionary<Guid, List<T>> index,
        Guid employeeId,
        DateTime asOf,
        Func<T, bool> predicate)
        where T : class
    {
        if (!index.TryGetValue(employeeId, out var values))
            return null;

        return values
            .Where(predicate)
            .OrderByDescending(GetEffectiveFrom)
            .FirstOrDefault();
    }

    private static DateTime GetEffectiveFrom<T>(T value)
        => value switch
        {
            Employment employment => employment.EffectiveFrom,
            WorkAssignment assignment => assignment.EffectiveFrom,
            ManagerRelationship relationship => relationship.EffectiveFrom,
            _ => DateTime.MinValue
        };
}
