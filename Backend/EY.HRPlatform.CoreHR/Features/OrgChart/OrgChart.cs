using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.OrgChart;

// --- Contracts ------------------------------------------------------------------------------------

/// <summary>
/// The people org chart as of a date, shaped for the viewer on the server. A Tenant-scope viewer gets everyone;
/// a DirectReports-scope viewer gets their own chain and branch, with every other branch folded into a count
/// under the visible person it hangs from. Open roles hang under their manager when the manager is visible: open
/// ones for everyone, on-hold ones for HR, and only from today on (they are a plan, not history).
/// </summary>
public sealed record OrgChartDto(
    DateOnly AsOf,
    string Scope,
    string? ViewerKey,
    IReadOnlyList<OrgChartPersonDto> People,
    IReadOnlyList<OrgChartFoldDto> Folded,
    IReadOnlyList<OrgChartOpenRoleDto> OpenRoles);

/// <param name="StartYear">Year the current employment started; null when the hire date is hidden from the viewer.</param>
/// <param name="StartDate">The full start date, for HR only (the Tenure lens); everyone else gets the year.</param>
/// <param name="IsNew">In the first 90 days of employment on the as-of date.</param>
/// <param name="DirectCount">Direct reports, whole tenant.</param>
/// <param name="TotalCount">Everyone below, whole tenant.</param>
public sealed record OrgChartPersonDto(
    string EmployeeKey,
    string DisplayName,
    string Initials,
    string? JobTitle,
    OrgChartUnitDto? Unit,
    string? WorkLocation,
    string? WorkEmail,
    int? StartYear,
    DateOnly? StartDate,
    bool IsNew,
    string? ManagerKey,
    IReadOnlyList<string> DottedLineManagerKeys,
    int DirectCount,
    int TotalCount);

/// <param name="DivisionId">The unit's top-level ancestor under the organization root (the unit itself at that level).</param>
public sealed record OrgChartUnitDto(Guid Id, string Name, Guid? DivisionId, string? DivisionName);

/// <summary>People the viewer may not see, counted under the visible person they report up to.</summary>
public sealed record OrgChartFoldDto(string ParentKey, int Count);

public static class OrgChartScopes
{
    public const string Tenant = "Tenant";
    public const string DirectReports = "DirectReports";
}

/// <param name="ViewerEmployeeId">The caller's own employee id from the token, never a request value.</param>
/// <param name="HrAudience">The viewer reads the whole workforce (HR): every field the tenant shows at all.</param>
public sealed record OrgChartQuery(
    DateOnly AsOf,
    string Scope,
    Guid? ViewerEmployeeId,
    bool HrAudience) : IQuery<Result<OrgChartDto>>;

// --- Handler --------------------------------------------------------------------------------------

public sealed class OrgChartQueryHandler(
    CoreHRDbContext dbContext,
    ITenantSettingsReadService tenantSettings) : IQueryHandler<OrgChartQuery, Result<OrgChartDto>>
{
    private const int NewForDays = 90;

    public async Task<Result<OrgChartDto>> Handle(OrgChartQuery request, CancellationToken cancellationToken)
    {
        // Every read runs inside the tenant query filter.
        var at = request.AsOf.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var employments = await dbContext.Employments.AsNoTracking()
            .Where(e => e.EffectiveFrom <= at && (e.EffectiveTo == null || at < e.EffectiveTo))
            .Select(e => new { e.EmployeeId, e.EffectiveFrom })
            .ToListAsync(cancellationToken);
        var startByEmployee = employments.GroupBy(e => e.EmployeeId)
            .ToDictionary(g => g.Key, g => g.Max(e => e.EffectiveFrom));
        var ids = startByEmployee.Keys.ToList();

        var employees = await dbContext.Employees.AsNoTracking()
            .Where(e => ids.Contains(e.Id))
            .Select(e => new PersonRow(e.Id, e.StableEmployeeKey, e.FirstName, e.LastName, e.PreferredName, e.Email))
            .ToListAsync(cancellationToken);

        var assignments = (await dbContext.WorkAssignments.AsNoTracking()
                .Where(w => ids.Contains(w.EmployeeId) && w.IsPrimary
                    && w.EffectiveFrom <= at && (w.EffectiveTo == null || at < w.EffectiveTo))
                .Select(w => new AssignmentRow(w.EmployeeId, w.OrgUnitId, w.JobTitle, w.WorkLocation, w.EffectiveFrom))
                .ToListAsync(cancellationToken))
            .GroupBy(w => w.EmployeeId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(w => w.EffectiveFrom).First());

        var relationships = await dbContext.ManagerRelationships.AsNoTracking()
            .Where(r => ids.Contains(r.SubjectEmployeeId) && ids.Contains(r.ManagerEmployeeId)
                && (r.Type == ReportingRelationshipType.PrimaryManager || r.Type == ReportingRelationshipType.SecondaryManager)
                && r.EffectiveFrom <= at && (r.EffectiveTo == null || at < r.EffectiveTo))
            .Select(r => new { r.SubjectEmployeeId, r.ManagerEmployeeId, r.Type, r.EffectiveFrom })
            .ToListAsync(cancellationToken);
        var managerOf = relationships.Where(r => r.Type == ReportingRelationshipType.PrimaryManager)
            .GroupBy(r => r.SubjectEmployeeId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(r => r.EffectiveFrom).First().ManagerEmployeeId);
        var dottedOf = relationships.Where(r => r.Type == ReportingRelationshipType.SecondaryManager)
            .GroupBy(r => r.SubjectEmployeeId)
            .ToDictionary(g => g.Key, g => g.Select(r => r.ManagerEmployeeId).Distinct().ToList());

        var units = await LoadUnitsAsync(dbContext, request.AsOf, cancellationToken);

        // Reporting tree over the whole tenant: counts are the same for every viewer.
        var reports = managerOf.GroupBy(pair => pair.Value)
            .ToDictionary(g => g.Key, g => g.Select(pair => pair.Key).ToList());
        var totals = new Dictionary<Guid, int>();
        int Total(Guid id, HashSet<Guid> path)
        {
            if (totals.TryGetValue(id, out var known)) return known;
            if (!path.Add(id)) return 0; // a cycle in bad data counts once, never loops
            var sum = reports.TryGetValue(id, out var direct) ? direct.Sum(child => 1 + Total(child, path)) : 0;
            path.Remove(id);
            return totals[id] = sum;
        }

        // Who the viewer may see.
        var visible = new HashSet<Guid>(ids);
        HashSet<Guid> branch = [];
        if (request.Scope == OrgChartScopes.DirectReports)
        {
            visible.Clear();
            if (request.ViewerEmployeeId is { } viewer && startByEmployee.ContainsKey(viewer))
            {
                var stack = new Stack<Guid>([viewer]);
                while (stack.Count > 0)
                {
                    var id = stack.Pop();
                    if (!branch.Add(id)) continue;
                    foreach (var child in reports.GetValueOrDefault(id) ?? []) stack.Push(child);
                }

                visible.UnionWith(branch);
                var seen = new HashSet<Guid> { viewer };
                for (var up = managerOf.GetValueOrDefault(viewer); up != Guid.Empty && seen.Add(up); up = managerOf.GetValueOrDefault(up))
                    visible.Add(up);
            }
        }

        var settings = await tenantSettings.GetCurrentAsync(cancellationToken);
        var keyOf = employees.ToDictionary(e => e.Id, e => e.StableEmployeeKey);
        var people = new List<OrgChartPersonDto>(visible.Count);
        foreach (var employee in employees.Where(e => visible.Contains(e.Id)))
        {
            // HR reads every shown field; a manager reads their own branch as a manager; everyone else as an employee.
            var audience = request.HrAudience ? EmployeeReadAudience.HrAdmin
                : branch.Contains(employee.Id) && employee.Id != request.ViewerEmployeeId ? EmployeeReadAudience.Manager
                : EmployeeReadAudience.Employee;
            var managerId = managerOf.GetValueOrDefault(employee.Id);

            people.Add(Card(employee, assignments.GetValueOrDefault(employee.Id), units, startByEmployee[employee.Id], at,
                managerId != Guid.Empty && visible.Contains(managerId) ? keyOf[managerId] : null,
                (dottedOf.GetValueOrDefault(employee.Id) ?? []).Where(visible.Contains).Select(id => keyOf[id]).ToList(),
                reports.GetValueOrDefault(employee.Id)?.Count ?? 0,
                Total(employee.Id, []),
                settings, audience));
        }

        var folded = request.Scope == OrgChartScopes.DirectReports
            ? visible
                .Select(id => (Id: id, Hidden: (reports.GetValueOrDefault(id) ?? []).Where(child => !visible.Contains(child)).ToList()))
                .Where(item => item.Hidden.Count > 0)
                .Select(item => new OrgChartFoldDto(keyOf[item.Id], item.Hidden.Sum(child => 1 + Total(child, []))))
                .ToList()
            : [];

        List<OrgChartOpenRoleDto> openRoles = [];
        if (request.AsOf >= DateOnly.FromDateTime(DateTime.UtcNow))
        {
            var roles = await dbContext.OpenRoles.AsNoTracking()
                .Where(role => visible.Contains(role.ManagerEmployeeId)
                    && (role.Status == OpenRoleStatus.Open || request.HrAudience && role.Status == OpenRoleStatus.OnHold))
                .OrderBy(role => role.CreatedAt)
                .ToListAsync(cancellationToken);
            openRoles = roles.Where(role => keyOf.ContainsKey(role.ManagerEmployeeId))
                .Select(role => new OrgChartOpenRoleDto(role.Id, role.JobTitle, keyOf[role.ManagerEmployeeId],
                    units.GetValueOrDefault(role.OrgUnitId), role.TargetStartDate, role.Status))
                .ToList();
        }

        var viewerKey = request.ViewerEmployeeId is { } self && keyOf.TryGetValue(self, out var key) ? key : null;
        return Result.Success(new OrgChartDto(
            request.AsOf,
            request.Scope,
            viewerKey,
            people.OrderBy(p => p.DisplayName, StringComparer.Ordinal).ToList(),
            folded,
            openRoles));
    }

    internal sealed record PersonRow(Guid Id, string StableEmployeeKey, string FirstName, string LastName, string? PreferredName, string? Email);

    internal sealed record AssignmentRow(Guid EmployeeId, Guid OrgUnitId, string JobTitle, string? WorkLocation, DateTime EffectiveFrom);

    internal sealed record UnitStateRow(Guid OrgUnitId, Guid? ParentOrgUnitId, string Name, DateOnly EffectiveFrom, DateOnly? EffectiveTo);

    /// <summary>A person's card as one audience reads it on a day: the tenant's field settings decide what shows.</summary>
    internal static OrgChartPersonDto Card(
        PersonRow employee,
        AssignmentRow? assignment,
        IReadOnlyDictionary<Guid, OrgChartUnitDto> units,
        DateTime start,
        DateTime at,
        string? managerKey,
        IReadOnlyList<string> dottedLineManagerKeys,
        int directCount,
        int totalCount,
        TenantSettingsDto settings,
        EmployeeReadAudience audience)
    {
        bool Shows(string field) => CanViewField(settings, field, audience);
        var displayName = $"{(string.IsNullOrWhiteSpace(employee.PreferredName) ? employee.FirstName : employee.PreferredName)} {employee.LastName}".Trim();

        return new OrgChartPersonDto(
            employee.StableEmployeeKey,
            displayName,
            Initials(displayName),
            Shows("jobTitle") && !string.IsNullOrWhiteSpace(assignment?.JobTitle) ? assignment!.JobTitle : null,
            assignment is not null && units.TryGetValue(assignment.OrgUnitId, out var unit) ? unit : null,
            Shows("workLocation") ? assignment?.WorkLocation : null,
            Shows("email") ? employee.Email : null,
            Shows("hireDate") ? start.Year : null,
            audience == EmployeeReadAudience.HrAdmin && Shows("hireDate") ? DateOnly.FromDateTime(start) : null,
            Shows("hireDate") && (at - start).TotalDays < NewForDays,
            managerKey,
            dottedLineManagerKeys,
            directCount,
            totalCount);
    }

    internal static async Task<Dictionary<Guid, OrgChartUnitDto>> LoadUnitsAsync(CoreHRDbContext dbContext, DateOnly asOf, CancellationToken cancellationToken)
        => UnitsAsOf(await LoadUnitStatesAsync(dbContext, asOf, cancellationToken), asOf);

    /// <summary>Unit states that still hold on or after the date.</summary>
    internal static Task<List<UnitStateRow>> LoadUnitStatesAsync(CoreHRDbContext dbContext, DateOnly onOrAfter, CancellationToken cancellationToken)
        => dbContext.OrgUnitEffectiveStates.AsNoTracking()
            .Where(s => s.EffectiveTo == null || onOrAfter < s.EffectiveTo)
            .Select(s => new UnitStateRow(s.OrgUnitId, s.ParentOrgUnitId, s.Name, s.EffectiveFrom, s.EffectiveTo))
            .ToListAsync(cancellationToken);

    /// <summary>
    /// Units as of the date, each with its division: the top-level ancestor under the organization root. A unit whose
    /// Fusion timeline starts after the date (its establishment, not proof it didn't exist) reads as its first state.
    /// </summary>
    internal static Dictionary<Guid, OrgChartUnitDto> UnitsAsOf(IEnumerable<UnitStateRow> unitStates, DateOnly asOf)
    {
        var states = unitStates
            .Where(s => s.EffectiveTo == null || asOf < s.EffectiveTo)
            .GroupBy(s => s.OrgUnitId)
            .ToDictionary(g => g.Key, g => g.Where(s => s.EffectiveFrom <= asOf).OrderByDescending(s => s.EffectiveFrom).FirstOrDefault()
                ?? g.OrderBy(s => s.EffectiveFrom).First());

        (Guid Id, string Name)? DivisionOf(Guid id)
        {
            var seen = new HashSet<Guid>();
            var current = states[id];
            while (current.ParentOrgUnitId is { } parent && states.TryGetValue(parent, out var up) && seen.Add(parent))
            {
                if (up.ParentOrgUnitId is null) return (current.OrgUnitId, current.Name);
                current = up;
            }

            return null; // the root itself
        }

        return states.Values.ToDictionary(s => s.OrgUnitId, s =>
        {
            var division = DivisionOf(s.OrgUnitId);
            return new OrgChartUnitDto(s.OrgUnitId, s.Name, division?.Id, division?.Name);
        });
    }

    private static string Initials(string displayName)
    {
        var words = displayName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return words.Length == 0 ? "?" : $"{words[0][0]}{words[^1][0]}".ToUpperInvariant();
    }

    private static bool CanViewField(TenantSettingsDto settings, string field, EmployeeReadAudience audience)
    {
        if (!settings.EmployeeFieldConfig.TryGetValue(field, out var config)) return true;
        return audience switch
        {
            EmployeeReadAudience.HrAdmin => config.Visible,
            EmployeeReadAudience.Manager => config.Visible && config.VisibleToManager,
            _ => config.Visible && config.VisibleToEmployee,
        };
    }
}

// --- Changes over a window (HR) -------------------------------------------------------------------

public static class OrgChartChangeKinds
{
    public const string Join = "Join";
    public const string Leave = "Leave";
    public const string Move = "Move";
}

/// <summary>A dated change to the chart: someone joins, leaves (their last employed day) or moves to a new manager.</summary>
/// <param name="ManagerKey">The manager they join or move to; null for a leaver.</param>
/// <param name="Person">The joiner's card as of their first day; null for leavers and moves.</param>
public sealed record OrgChartChangeDto(
    string Kind,
    DateOnly Date,
    string EmployeeKey,
    string? ManagerKey,
    OrgChartPersonDto? Person);

/// <param name="From">First day of the window, inclusive.</param>
/// <param name="To">Last day of the window, inclusive.</param>
public sealed record OrgChartChangesQuery(DateOnly From, DateOnly To) : IQuery<Result<IReadOnlyList<OrgChartChangeDto>>>;

public sealed class OrgChartChangesQueryHandler(
    CoreHRDbContext dbContext,
    ITenantSettingsReadService tenantSettings) : IQueryHandler<OrgChartChangesQuery, Result<IReadOnlyList<OrgChartChangeDto>>>
{
    public async Task<Result<IReadOnlyList<OrgChartChangeDto>>> Handle(OrgChartChangesQuery request, CancellationToken cancellationToken)
    {
        var from = request.From.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var to = request.To.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var dayBeforeFrom = from.AddDays(-1);
        var dayAfterTo = to.AddDays(1);

        // One read of everything that holds anywhere from the day before the window to the day after it: enough to
        // tell a join from a renewal and a move from a join, and to build each joiner's card as of their first day.
        var spans = await dbContext.Employments.AsNoTracking()
            .Where(e => e.EffectiveFrom <= dayAfterTo && (e.EffectiveTo == null || e.EffectiveTo > dayBeforeFrom))
            .Select(e => new { e.EmployeeId, e.EffectiveFrom, e.EffectiveTo })
            .ToListAsync(cancellationToken);
        var spansOf = spans.ToLookup(e => e.EmployeeId);
        bool EmployedOn(Guid id, DateTime day) => spansOf[id].Any(e => e.EffectiveFrom <= day && (e.EffectiveTo == null || day < e.EffectiveTo));
        var employments = spans
            .Where(e => (e.EffectiveFrom >= from && e.EffectiveFrom <= to)
                || (e.EffectiveTo != null && e.EffectiveTo > from && e.EffectiveTo <= dayAfterTo))
            .ToList();

        var lines = await dbContext.ManagerRelationships.AsNoTracking()
            .Where(r => (r.Type == ReportingRelationshipType.PrimaryManager || r.Type == ReportingRelationshipType.SecondaryManager)
                && r.EffectiveFrom <= to && (r.EffectiveTo == null || r.EffectiveTo > dayBeforeFrom))
            .Select(r => new { r.SubjectEmployeeId, r.ManagerEmployeeId, r.Type, r.EffectiveFrom, r.EffectiveTo })
            .ToListAsync(cancellationToken);
        var primaryOf = lines.Where(r => r.Type == ReportingRelationshipType.PrimaryManager).ToLookup(r => r.SubjectEmployeeId);
        var primaryUnder = lines.Where(r => r.Type == ReportingRelationshipType.PrimaryManager).ToLookup(r => r.ManagerEmployeeId);
        var dottedOf = lines.Where(r => r.Type == ReportingRelationshipType.SecondaryManager).ToLookup(r => r.SubjectEmployeeId);
        var relationships = lines
            .Where(r => r.Type == ReportingRelationshipType.PrimaryManager && r.EffectiveFrom >= from && r.EffectiveFrom <= to)
            .ToList();
        Guid? ManagerOn(Guid id, DateTime day) => primaryOf[id]
            .FirstOrDefault(r => r.EffectiveFrom <= day && (r.EffectiveTo == null || day < r.EffectiveTo))?.ManagerEmployeeId;

        var employeeIds = spans.Select(e => e.EmployeeId).Concat(relationships.Select(r => r.ManagerEmployeeId)).Distinct().ToList();
        var employees = await dbContext.Employees.AsNoTracking()
            .Where(e => employeeIds.Contains(e.Id))
            .Select(e => new OrgChartQueryHandler.PersonRow(e.Id, e.StableEmployeeKey, e.FirstName, e.LastName, e.PreferredName, e.Email))
            .ToDictionaryAsync(e => e.Id, cancellationToken);
        var keyOf = employees.ToDictionary(pair => pair.Key, pair => pair.Value.StableEmployeeKey);

        var changes = new List<OrgChartChangeDto>();
        var joins = employments
            .Where(e => e.EffectiveFrom >= from && e.EffectiveFrom <= to && !EmployedOn(e.EmployeeId, e.EffectiveFrom.AddDays(-1)))
            .ToList();
        if (joins.Count > 0)
        {
            // Each joiner's card as HR sees it on their first day, built the way the chart builds it for that date.
            var joinerIds = joins.Select(e => e.EmployeeId).Distinct().ToList();
            var assignments = (await dbContext.WorkAssignments.AsNoTracking()
                    .Where(w => joinerIds.Contains(w.EmployeeId) && w.IsPrimary
                        && w.EffectiveFrom <= to && (w.EffectiveTo == null || w.EffectiveTo > from))
                    .Select(w => new { Row = new OrgChartQueryHandler.AssignmentRow(w.EmployeeId, w.OrgUnitId, w.JobTitle, w.WorkLocation, w.EffectiveFrom), w.EffectiveTo })
                    .ToListAsync(cancellationToken))
                .ToLookup(w => w.Row.EmployeeId);
            var unitStates = await OrgChartQueryHandler.LoadUnitStatesAsync(dbContext, request.From, cancellationToken);
            var unitsOn = new Dictionary<DateOnly, Dictionary<Guid, OrgChartUnitDto>>();
            var settings = await tenantSettings.GetCurrentAsync(cancellationToken);

            // The reporting tree on a day, as the chart reads it: a primary line between two people employed that day,
            // the latest one per person.
            Guid ManagerOfOn(Guid id, DateTime day) => primaryOf[id]
                .Where(r => r.EffectiveFrom <= day && (r.EffectiveTo == null || day < r.EffectiveTo) && EmployedOn(r.ManagerEmployeeId, day))
                .OrderByDescending(r => r.EffectiveFrom)
                .FirstOrDefault()?.ManagerEmployeeId ?? Guid.Empty;
            List<Guid> ReportsOn(Guid id, DateTime day) => primaryUnder[id]
                .Where(r => r.EffectiveFrom <= day && (r.EffectiveTo == null || day < r.EffectiveTo))
                .Select(r => r.SubjectEmployeeId)
                .Distinct()
                .Where(child => EmployedOn(child, day) && ManagerOfOn(child, day) == id)
                .ToList();
            int TotalOn(Guid id, DateTime day, HashSet<Guid> path)
            {
                if (!path.Add(id)) return 0; // a cycle in bad data counts once, never loops
                var sum = ReportsOn(id, day).Sum(child => 1 + TotalOn(child, day, path));
                path.Remove(id);
                return sum;
            }

            foreach (var join in joins)
            {
                var day = DateOnly.FromDateTime(join.EffectiveFrom);
                var at = join.EffectiveFrom;
                if (!employees.TryGetValue(join.EmployeeId, out var employee) || !EmployedOn(join.EmployeeId, at)) continue;

                if (!unitsOn.TryGetValue(day, out var units)) unitsOn[day] = units = OrgChartQueryHandler.UnitsAsOf(unitStates, day);
                var assignment = assignments[join.EmployeeId]
                    .Where(w => w.Row.EffectiveFrom <= at && (w.EffectiveTo == null || at < w.EffectiveTo))
                    .OrderByDescending(w => w.Row.EffectiveFrom)
                    .FirstOrDefault()?.Row;
                var start = spansOf[join.EmployeeId].Where(e => e.EffectiveFrom <= at && (e.EffectiveTo == null || at < e.EffectiveTo)).Max(e => e.EffectiveFrom);
                var managerId = ManagerOfOn(join.EmployeeId, at);
                var dotted = dottedOf[join.EmployeeId]
                    .Where(r => r.EffectiveFrom <= at && (r.EffectiveTo == null || at < r.EffectiveTo) && EmployedOn(r.ManagerEmployeeId, at))
                    .Select(r => r.ManagerEmployeeId)
                    .Distinct()
                    .Select(id => keyOf[id])
                    .ToList();

                var card = OrgChartQueryHandler.Card(employee, assignment, units, start, at,
                    managerId != Guid.Empty ? keyOf[managerId] : null,
                    dotted,
                    ReportsOn(join.EmployeeId, at).Count,
                    TotalOn(join.EmployeeId, at, []),
                    settings, EmployeeReadAudience.HrAdmin);
                changes.Add(new OrgChartChangeDto(OrgChartChangeKinds.Join, day, card.EmployeeKey, card.ManagerKey, card));
            }
        }

        foreach (var leave in employments.Where(e => e.EffectiveTo is { } end && end > from && end <= dayAfterTo))
        {
            var boundary = leave.EffectiveTo!.Value;
            if (EmployedOn(leave.EmployeeId, boundary) || !keyOf.TryGetValue(leave.EmployeeId, out var key)) continue;
            changes.Add(new OrgChartChangeDto(OrgChartChangeKinds.Leave, DateOnly.FromDateTime(boundary.AddDays(-1)), key, null, null));
        }

        foreach (var move in relationships)
        {
            // A move leaves one manager for another: a first manager (on the first day, part of the join) or a
            // re-link to the same manager isn't one.
            var dayBefore = move.EffectiveFrom.AddDays(-1);
            if (!EmployedOn(move.SubjectEmployeeId, dayBefore)
                || ManagerOn(move.SubjectEmployeeId, dayBefore) is not { } previous || previous == move.ManagerEmployeeId) continue;
            if (!keyOf.TryGetValue(move.SubjectEmployeeId, out var key) || !keyOf.TryGetValue(move.ManagerEmployeeId, out var manager)) continue;
            changes.Add(new OrgChartChangeDto(OrgChartChangeKinds.Move, DateOnly.FromDateTime(move.EffectiveFrom), key, manager, null));
        }

        return Result.Success<IReadOnlyList<OrgChartChangeDto>>(changes
            .OrderBy(c => c.Date).ThenBy(c => c.Kind, StringComparer.Ordinal).ThenBy(c => c.EmployeeKey, StringComparer.Ordinal)
            .ToList());
    }
}
