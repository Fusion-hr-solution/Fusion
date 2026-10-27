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
/// under the visible person it hangs from.
/// </summary>
public sealed record OrgChartDto(
    DateOnly AsOf,
    string Scope,
    string? ViewerKey,
    IReadOnlyList<OrgChartPersonDto> People,
    IReadOnlyList<OrgChartFoldDto> Folded);

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
            .Select(e => new { e.Id, e.StableEmployeeKey, e.FirstName, e.LastName, e.PreferredName, e.Email })
            .ToListAsync(cancellationToken);

        var assignments = (await dbContext.WorkAssignments.AsNoTracking()
                .Where(w => ids.Contains(w.EmployeeId) && w.IsPrimary
                    && w.EffectiveFrom <= at && (w.EffectiveTo == null || at < w.EffectiveTo))
                .Select(w => new { w.EmployeeId, w.OrgUnitId, w.JobTitle, w.WorkLocation, w.EffectiveFrom })
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

        var units = await LoadUnitsAsync(request.AsOf, cancellationToken);

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
            bool Shows(string field) => CanViewField(settings, field, audience);

            var assignment = assignments.GetValueOrDefault(employee.Id);
            var start = startByEmployee[employee.Id];
            var displayName = $"{(string.IsNullOrWhiteSpace(employee.PreferredName) ? employee.FirstName : employee.PreferredName)} {employee.LastName}".Trim();
            var managerId = managerOf.GetValueOrDefault(employee.Id);

            people.Add(new OrgChartPersonDto(
                employee.StableEmployeeKey,
                displayName,
                Initials(displayName),
                Shows("jobTitle") && !string.IsNullOrWhiteSpace(assignment?.JobTitle) ? assignment!.JobTitle : null,
                assignment is not null && units.TryGetValue(assignment.OrgUnitId, out var unit) ? unit : null,
                Shows("workLocation") ? assignment?.WorkLocation : null,
                Shows("email") ? employee.Email : null,
                Shows("hireDate") ? start.Year : null,
                request.HrAudience && Shows("hireDate") ? DateOnly.FromDateTime(start) : null,
                Shows("hireDate") && (at - start).TotalDays < NewForDays,
                managerId != Guid.Empty && visible.Contains(managerId) ? keyOf[managerId] : null,
                (dottedOf.GetValueOrDefault(employee.Id) ?? []).Where(visible.Contains).Select(id => keyOf[id]).ToList(),
                reports.GetValueOrDefault(employee.Id)?.Count ?? 0,
                Total(employee.Id, [])));
        }

        var folded = request.Scope == OrgChartScopes.DirectReports
            ? visible
                .Select(id => (Id: id, Hidden: (reports.GetValueOrDefault(id) ?? []).Where(child => !visible.Contains(child)).ToList()))
                .Where(item => item.Hidden.Count > 0)
                .Select(item => new OrgChartFoldDto(keyOf[item.Id], item.Hidden.Sum(child => 1 + Total(child, []))))
                .ToList()
            : [];

        var viewerKey = request.ViewerEmployeeId is { } self && keyOf.TryGetValue(self, out var key) ? key : null;
        return Result.Success(new OrgChartDto(
            request.AsOf,
            request.Scope,
            viewerKey,
            people.OrderBy(p => p.DisplayName, StringComparer.Ordinal).ToList(),
            folded));
    }

    /// <summary>
    /// Units as of the date, each with its division: the top-level ancestor under the organization root. A unit whose
    /// Fusion timeline starts after the date (its establishment, not proof it didn't exist) reads as its first state.
    /// </summary>
    private async Task<Dictionary<Guid, OrgChartUnitDto>> LoadUnitsAsync(DateOnly asOf, CancellationToken cancellationToken)
    {
        var states = (await dbContext.OrgUnitEffectiveStates.AsNoTracking()
                .Where(s => s.EffectiveTo == null || asOf < s.EffectiveTo)
                .Select(s => new { s.OrgUnitId, s.ParentOrgUnitId, s.Name, s.EffectiveFrom })
                .ToListAsync(cancellationToken))
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
        var dayAfterTo = to.AddDays(1);

        var employments = await dbContext.Employments.AsNoTracking()
            .Where(e => (e.EffectiveFrom >= from && e.EffectiveFrom <= to)
                || (e.EffectiveTo != null && e.EffectiveTo > from && e.EffectiveTo <= dayAfterTo))
            .Select(e => new { e.EmployeeId, e.EffectiveFrom, e.EffectiveTo })
            .ToListAsync(cancellationToken);
        var relationships = await dbContext.ManagerRelationships.AsNoTracking()
            .Where(r => r.Type == ReportingRelationshipType.PrimaryManager && r.EffectiveFrom >= from && r.EffectiveFrom <= to)
            .Select(r => new { r.SubjectEmployeeId, r.ManagerEmployeeId, r.EffectiveFrom })
            .ToListAsync(cancellationToken);

        // Employment boundaries touching the window, to tell a join from a renewal and a move from a join.
        var subjects = employments.Select(e => e.EmployeeId).Concat(relationships.Select(r => r.SubjectEmployeeId)).Distinct().ToList();
        var spans = (await dbContext.Employments.AsNoTracking()
                .Where(e => subjects.Contains(e.EmployeeId))
                .Select(e => new { e.EmployeeId, e.EffectiveFrom, e.EffectiveTo })
                .ToListAsync(cancellationToken))
            .ToLookup(e => e.EmployeeId);
        bool EmployedOn(Guid id, DateTime day) => spans[id].Any(e => e.EffectiveFrom <= day && (e.EffectiveTo == null || day < e.EffectiveTo));

        var movers = relationships.Select(r => r.SubjectEmployeeId).Distinct().ToList();
        var managersOf = (await dbContext.ManagerRelationships.AsNoTracking()
                .Where(r => r.Type == ReportingRelationshipType.PrimaryManager && movers.Contains(r.SubjectEmployeeId))
                .Select(r => new { r.SubjectEmployeeId, r.ManagerEmployeeId, r.EffectiveFrom, r.EffectiveTo })
                .ToListAsync(cancellationToken))
            .ToLookup(r => r.SubjectEmployeeId);
        Guid? ManagerOn(Guid id, DateTime day) => managersOf[id]
            .FirstOrDefault(r => r.EffectiveFrom <= day && (r.EffectiveTo == null || day < r.EffectiveTo))?.ManagerEmployeeId;

        var managerIds = relationships.Select(r => r.ManagerEmployeeId);
        var keyIds = subjects.Concat(managerIds).Distinct().ToList();
        var keyOf = await dbContext.Employees.AsNoTracking()
            .Where(e => keyIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, e => e.StableEmployeeKey, cancellationToken);

        var changes = new List<OrgChartChangeDto>();
        var joinDays = employments
            .Where(e => e.EffectiveFrom >= from && e.EffectiveFrom <= to && !EmployedOn(e.EmployeeId, e.EffectiveFrom.AddDays(-1)))
            .GroupBy(e => DateOnly.FromDateTime(e.EffectiveFrom));
        var chart = new OrgChartQueryHandler(dbContext, tenantSettings);
        foreach (var day in joinDays)
        {
            // The joiner's card as HR sees it on their first day: the same read model the chart serves.
            var snapshot = (await chart.Handle(new OrgChartQuery(day.Key, OrgChartScopes.Tenant, null, HrAudience: true), cancellationToken)).Value;
            var cards = snapshot.People.ToDictionary(p => p.EmployeeKey);
            foreach (var join in day)
            {
                if (!keyOf.TryGetValue(join.EmployeeId, out var key) || !cards.TryGetValue(key, out var card)) continue;
                changes.Add(new OrgChartChangeDto(OrgChartChangeKinds.Join, day.Key, key, card.ManagerKey, card));
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
