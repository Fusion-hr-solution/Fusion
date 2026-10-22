using System.Globalization;
using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Notifications;

/// <summary>The shared Fusion notification contract (`@repo/api` FusionNotification).</summary>
public sealed record FusionNotificationDto(string Id, string Module, string Kind, string Title, string? Context,
    string? ActorName, DateTime OccurredAt, string Href, DateTime? ReadAt);
public sealed record FusionNotificationPageDto(IReadOnlyList<FusionNotificationDto> Items, int UnreadCount, string? NextCursor);
public sealed record MarkNotificationsReadRequest(IReadOnlyList<Guid>? Ids, bool? All);
public sealed record MarkNotificationsReadResultDto(int UnreadCount);

/// <summary>Who the feed belongs to: the caller's employee record and account, in the caller's tenant.</summary>
public sealed record NotificationRecipient(Guid? EmployeeId, Guid? UserId);

public sealed record GetNotificationsQuery(NotificationRecipient Recipient, string? Cursor, int? Limit)
    : IQuery<Result<FusionNotificationPageDto>>;
public sealed record MarkNotificationsReadCommand(NotificationRecipient Recipient, IReadOnlyList<Guid> Ids, bool All)
    : ICommand<Result<MarkNotificationsReadResultDto>>;

public static class NotificationFeed
{
    public const int MaxPageSize = 20;
    public const int MaxIdsPerRead = 100;

    /// <summary>
    /// Only the caller's own, still-retained notifications. The tenant query filter scopes the rows;
    /// the recipient match is by employee record or, for a facilitator without one, by account.
    /// </summary>
    public static IQueryable<PerformanceNotification> Own(PerformanceDbContext db, NotificationRecipient recipient, DateTime now)
    {
        var retainedFrom = now.AddDays(-PerformanceNotification.RetentionDays);
        var employeeId = recipient.EmployeeId;
        var userId = recipient.UserId;
        return db.Notifications.Where(n => n.OccurredAt >= retainedFrom
            && ((employeeId != null && n.RecipientEmployeeId == employeeId) || (userId != null && n.RecipientUserId == userId)));
    }

    public static FusionNotificationDto ToDto(PerformanceNotification n)
        => new(n.Id.ToString(), "performance", n.Kind.ToString(), n.Title, n.Context, n.ActorName, n.OccurredAt, n.Href, n.ReadAt);

    public static string EncodeCursor(DateTime occurredAt) => occurredAt.Ticks.ToString(CultureInfo.InvariantCulture);

    public static DateTime? DecodeCursor(string? cursor)
        => long.TryParse(cursor, NumberStyles.None, CultureInfo.InvariantCulture, out var ticks)
            && ticks > 0 && ticks <= DateTime.MaxValue.Ticks
            ? new DateTime(ticks, DateTimeKind.Utc) : null;
}

public sealed class GetNotificationsHandler(PerformanceDbContext db)
    : IQueryHandler<GetNotificationsQuery, Result<FusionNotificationPageDto>>
{
    public async Task<Result<FusionNotificationPageDto>> Handle(GetNotificationsQuery query, CancellationToken token)
    {
        var now = PerformanceClock.UtcNow;
        var own = NotificationFeed.Own(db, query.Recipient, now).AsNoTracking();
        var limit = Math.Clamp(query.Limit ?? NotificationFeed.MaxPageSize, 1, NotificationFeed.MaxPageSize);
        var page = own;
        if (NotificationFeed.DecodeCursor(query.Cursor) is DateTime before) page = page.Where(n => n.OccurredAt < before);
        var rows = await page.OrderByDescending(n => n.OccurredAt).ThenByDescending(n => n.Id)
            .Take(limit + 1).ToListAsync(token);
        var unread = await own.CountAsync(n => n.ReadAt == null, token);
        var items = rows.Take(limit).Select(NotificationFeed.ToDto).ToList();
        var next = rows.Count > limit ? NotificationFeed.EncodeCursor(rows[limit - 1].OccurredAt) : null;
        return Result.Success(new FusionNotificationPageDto(items, unread, next));
    }
}

public sealed class MarkNotificationsReadHandler(PerformanceDbContext db)
    : ICommandHandler<MarkNotificationsReadCommand, Result<MarkNotificationsReadResultDto>>
{
    public async Task<Result<MarkNotificationsReadResultDto>> Handle(MarkNotificationsReadCommand command, CancellationToken token)
    {
        var now = PerformanceClock.UtcNow;
        var own = NotificationFeed.Own(db, command.Recipient, now);
        // Ids that aren't the caller's simply don't match: the answer never reveals whether they exist.
        var targets = command.All
            ? own.Where(n => n.ReadAt == null)
            : own.Where(n => n.ReadAt == null && command.Ids.Contains(n.Id));
        foreach (var notification in await targets.ToListAsync(token)) notification.MarkRead(now);
        await db.SaveChangesAsync(token);
        var unread = await own.CountAsync(n => n.ReadAt == null, token);
        return Result.Success(new MarkNotificationsReadResultDto(unread));
    }
}

/// <summary>Deletes in-app notifications past retention, one tenant at a time under its own filter.</summary>
public sealed class PerformanceNotificationRetention(IServiceScopeFactory scopes)
{
    public async Task<int> PurgeAsync(DateTime now, CancellationToken cancellationToken)
    {
        var cutoff = now.AddDays(-PerformanceNotification.RetentionDays);
        List<Guid> tenants;
        await using (var discovery = scopes.CreateAsyncScope())
        {
            var db = discovery.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            // Background discovery reads tenant identifiers only; the delete stays tenant-filtered.
            tenants = await db.Database.SqlQuery<Guid>($"""
                SELECT DISTINCT n."TenantId" AS "Value" FROM performance."PerformanceNotifications" n
                WHERE n."OccurredAt" < {cutoff}
                """).ToListAsync(cancellationToken);
        }
        var removed = 0;
        foreach (var tenantId in tenants)
        {
            await using var scope = scopes.CreateAsyncScope();
            scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);
            var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            removed += await db.Notifications.Where(n => n.OccurredAt < cutoff).ExecuteDeleteAsync(cancellationToken);
        }
        return removed;
    }
}
