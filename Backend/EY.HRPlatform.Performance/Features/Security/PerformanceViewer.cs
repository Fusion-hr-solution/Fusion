using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Security;

public sealed record CycleViewer(GoalActorContext Actor, Guid? GovernedOrgUnitId);
public sealed record CycleResponsibilities(bool Participates, IReadOnlyList<Guid> ReviewedEmployeeIds);

/// <summary>Request-scoped caller facts. Core supplies team governance; Performance supplies review responsibility.</summary>
public sealed class PerformanceViewer(PerformanceDbContext db, ICoreWorkforceClient workforce, IHttpContextAccessor? http = null)
{
    private readonly Dictionary<(Guid, GoalActorContext), Task<CycleViewer>> _cycles = [];
    private readonly Dictionary<Guid, Task<CycleResponsibilities>> _responsibilities = [];

    public Guid? TenantId => http?.HttpContext?.User.GetTenantId();
    public Guid? UserId => http?.HttpContext?.User.GetUserId();
    public Guid? EmployeeId => http?.HttpContext?.User.GetEmployeeId();
    public IReadOnlyList<EffectivePermissionGrant> Grants => http?.HttpContext?.User.GetCorePermissions() ?? [];

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
