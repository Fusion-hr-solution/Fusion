using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Security;

public sealed record CycleViewer(GoalActorContext Actor, Guid? GovernedOrgUnitId);
public sealed record CycleResponsibilities(bool Participates, IReadOnlyList<Guid> ReviewedEmployeeIds);

/// <summary>
/// The caller's reporting line in Core HR now: their own snapshot (with their primary manager) and their active direct
/// reports. Conversations (1:1s, manager feedback) follow the current line, not a cycle's snapshot.
/// </summary>
public sealed record CurrentLine(WorkforceSnapshot? Self, IReadOnlyList<WorkforceSnapshot> DirectReports)
{
    public static readonly CurrentLine None = new(null, []);
    public Guid? ManagerEmployeeId => Self is { IsActive: true, Manager: { IsActive: true } manager } ? manager.EmployeeId : null;
    public IReadOnlySet<Guid> DirectReportIds { get; } = DirectReports.Select(r => r.EmployeeId).ToHashSet();
}

/// <summary>Request-scoped caller facts. Core supplies team governance; Performance supplies review responsibility.</summary>
public sealed class PerformanceViewer(PerformanceDbContext db, ICoreWorkforceClient workforce, IHttpContextAccessor? http = null)
{
    private readonly Dictionary<(Guid, GoalActorContext), Task<CycleViewer>> _cycles = [];
    private readonly Dictionary<Guid, Task<CycleResponsibilities>> _responsibilities = [];

    public Guid? TenantId => http?.HttpContext?.User.GetTenantId();
    public Guid? UserId => http?.HttpContext?.User.GetUserId();
    public Guid? EmployeeId => http?.HttpContext?.User.GetEmployeeId();
    public IReadOnlyList<EffectivePermissionGrant> Grants => http?.HttpContext?.User.GetCorePermissions() ?? [];

    private Task<CurrentLine>? _line;

    /// <summary>Once per request: Core HR's current line for the caller. Throws <see cref="HttpRequestException"/> when Core is down.</summary>
    public Task<CurrentLine> CurrentLineAsync(CancellationToken cancellationToken)
        => _line ??= LoadLineAsync(cancellationToken);

    private async Task<CurrentLine> LoadLineAsync(CancellationToken cancellationToken)
    {
        if (EmployeeId is not Guid me || me == Guid.Empty) return CurrentLine.None;
        var now = DateTime.UtcNow;
        var self = (await workforce.ResolveAsync(now, [me], cancellationToken)).SingleOrDefault(s => s.EmployeeId == me);
        var reports = await workforce.GetDirectReportsAsync(now, [me], cancellationToken);
        return new CurrentLine(self, reports.Where(r => r.EmployeeId != me).ToList());
    }

    public Task<CycleViewer> ForCycleAsync(PerformanceCycle cycle, GoalActorContext actor, CancellationToken cancellationToken)
    {
        var key = (cycle.Id, actor);
        if (!_cycles.TryGetValue(key, out var result))
            _cycles[key] = result = ResolveAsync(cycle, actor, cancellationToken);
        return result;
    }

    private async Task<CycleViewer> ResolveAsync(PerformanceCycle cycle, GoalActorContext actor, CancellationToken cancellationToken)
    {
        if (actor.IsAdmin || !actor.HasOrgManageGrant || actor.CallerEmployeeId == Guid.Empty)
            return new(actor, null);
        var caller = (await workforce.ResolveAsync(cycle.StartDate.ToDateTime(TimeOnly.MinValue),
            [actor.CallerEmployeeId], cancellationToken)).SingleOrDefault();
        return new(actor, caller is { IsActive: true, OrgUnit: not null } ? caller.OrgUnit.OrgUnitId : null);
    }

    public Task<CycleResponsibilities> ResponsibilitiesAsync(Guid cycleId, CancellationToken cancellationToken)
    {
        if (!_responsibilities.TryGetValue(cycleId, out var result))
            _responsibilities[cycleId] = result = LoadResponsibilitiesAsync(cycleId, cancellationToken);
        return result;
    }

    private async Task<CycleResponsibilities> LoadResponsibilitiesAsync(Guid cycleId, CancellationToken cancellationToken)
    {
        if (EmployeeId is not Guid employeeId) return new(false, []);
        var participates = await db.Participants.AnyAsync(p => p.CycleId == cycleId && p.EmployeeId == employeeId, cancellationToken);
        var participantIds = db.Participants.Where(p => p.CycleId == cycleId && p.ManagerEmployeeId == employeeId).Select(p => p.EmployeeId);
        var planIds = db.EmployeePlans.Where(p => p.CycleId == cycleId && p.ResponsibleManagerId == employeeId).Select(p => p.EmployeeId);
        return new(participates, await participantIds.Union(planIds).ToListAsync(cancellationToken));
    }
}
