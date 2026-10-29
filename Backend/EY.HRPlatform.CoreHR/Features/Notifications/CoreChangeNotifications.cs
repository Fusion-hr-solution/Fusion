using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.People.Changes;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Notifications;

/// <summary>
/// Stages what a recorded workforce change tells people (B-002 N8), on the change's own unit of work so the notifications
/// commit or roll back with it. A change recorded ahead tells people when it's recorded; on its date it shows under
/// Upcoming instead of being announced again. Whoever recorded it is never told about it.
/// </summary>
public sealed class CoreChangeNotifications(CoreHRDbContext db, IHttpContextAccessor? http = null)
{
    public async Task StageAsync(WorkforceChange change, WorkforceChangeDetails details, CancellationToken cancellationToken)
    {
        var employee = db.Employees.Local.FirstOrDefault(item => item.Id == change.EmployeeId)
            ?? await db.Employees.FirstOrDefaultAsync(item => item.Id == change.EmployeeId, cancellationToken);
        if (employee is null) return;

        var teamStaying = await CoreChangeMoments.TeamStayingAsync(db, change, details, cancellationToken);
        var moments = CoreChangeMoments.Of(change, details, WorkforceChangeService.Ref(employee), teamStaying);
        var actorEmployeeId = http?.HttpContext?.User.GetEmployeeId();
        var actorName = ChangeSupport.ActorName(change.CreatedBy);
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        foreach (var moment in moments)
        {
            if (moment.RecipientEmployeeId == actorEmployeeId) continue;
            var notification = CoreNotification.For(change.TenantId, moment.RecipientEmployeeId, moment.Kind, change.Id,
                CoreChangeMoments.Words(moment, CoreMomentTense.Recorded, today, actorName, actorEmployeeId), now);
            if (db.Notifications.Local.Any(item => item.DedupeKey == notification.DedupeKey)) continue;
            db.Notifications.Add(notification);
        }
    }
}
